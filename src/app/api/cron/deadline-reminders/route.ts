import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDeadlineReminderEmail } from "@/lib/email";

/**
 * Vercel Cron Job — runs daily at 08:00 UTC (configured in vercel.json).
 * Finds tasks due in exactly 2 days and emails students who haven't submitted yet.
 *
 * Secured with CRON_SECRET env var:
 *   Authorization: Bearer <CRON_SECRET>
 * Vercel sets this automatically when using cron jobs.
 */
export async function GET(req: NextRequest) {
  // Verify request comes from Vercel cron (or a manual test with the right secret)
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Target date: today + 2 days (YYYY-MM-DD in UTC)
  const target = new Date();
  target.setUTCDate(target.getUTCDate() + 2);
  const targetDate = target.toISOString().slice(0, 10);

  // Fetch open tasks due on the target date
  const { data: tasks, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, major, assignment_type, assigned_user_id, due_date")
    .eq("status", "open")
    .eq("due_date", targetDate)
    .returns<
      Array<{
        id: string;
        title: string;
        major: string | null;
        assignment_type: string | null;
        assigned_user_id: string | null;
        due_date: string;
      }>
    >();

  if (taskError) {
    console.error("[cron] failed to fetch tasks:", taskError);
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ sent: 0, message: "No tasks due in 2 days." });
  }

  // Fetch all auth users once — build email map { userId → email }
  const { data: usersPage, error: usersError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) {
    console.error("[cron] failed to list users:", usersError);
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }
  const emailMap: Record<string, string> = {};
  for (const u of usersPage.users) {
    if (u.email) emailMap[u.id] = u.email;
  }

  // Fetch student profiles (role = 'student') — build major + name map
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, major, role")
    .eq("role", "student")
    .returns<
      Array<{ id: string; full_name: string | null; major: string | null; role: string }>
    >();
  const profileMap: Record<string, { full_name: string | null; major: string | null }> = {};
  for (const p of profiles ?? []) {
    profileMap[p.id] = { full_name: p.full_name, major: p.major };
  }

  let totalSent = 0;

  for (const task of tasks) {
    // Determine which student IDs should receive this task
    let targetUserIds: string[] = [];

    if (task.assignment_type === "specific_user" && task.assigned_user_id) {
      targetUserIds = [task.assigned_user_id];
    } else if (task.assignment_type === "major" && task.major) {
      targetUserIds = (profiles ?? [])
        .filter((p) => p.major === task.major)
        .map((p) => p.id);
    } else {
      // Fallback: all students in the task's major
      if (task.major) {
        targetUserIds = (profiles ?? [])
          .filter((p) => p.major === task.major)
          .map((p) => p.id);
      }
    }

    if (targetUserIds.length === 0) continue;

    // Exclude students who already submitted
    const { data: submitted } = await supabase
      .from("submissions")
      .select("user_id")
      .eq("task_id", task.id)
      .in("user_id", targetUserIds)
      .returns<Array<{ user_id: string }>>();

    const submittedIds = new Set((submitted ?? []).map((s) => s.user_id));
    const pendingIds = targetUserIds.filter((id) => !submittedIds.has(id));

    for (const userId of pendingIds) {
      const email = emailMap[userId];
      if (!email) continue;

      const studentName = profileMap[userId]?.full_name ?? "there";

      try {
        await sendDeadlineReminderEmail({
          toEmail: email,
          studentName,
          taskTitle: task.title,
          taskId: task.id,
          dueDate: task.due_date,
        });
        totalSent++;
      } catch (err) {
        console.error(`[cron] failed to email ${userId}:`, err);
      }
    }
  }

  return NextResponse.json({
    sent: totalSent,
    tasksChecked: tasks.length,
    targetDate,
  });
}
