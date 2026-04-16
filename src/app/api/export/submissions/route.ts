import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMajorFilter } from "@/lib/auth";
import type { StaffProfile } from "@/lib/auth";

type SubmissionExportRow = {
  id: string;
  task_id: string;
  user_id: string;
  content: string | null;
  link_url: string | null;
  file_name: string | null;
  submitted_at: string | null;
  review_status: string | null;
  score: number | null;
  admin_feedback: string | null;
  reviewed_at: string | null;
  version: number | null;
};

type TaskRow = { id: string; title: string; major: string | null };
type ProfileRow = { id: string; full_name: string | null; major: string | null };

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

export async function GET() {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("id, full_name, role, assigned_major, assigned_majors")
    .eq("id", user.id)
    .maybeSingle<StaffProfile>();

  if (!profileRaw || (profileRaw.role !== "admin" && profileRaw.role !== "manager")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const majorFilter = getMajorFilter(profileRaw);

  // Fetch tasks (scoped by major)
  let tasksQuery = supabase.from("tasks").select("id, title, major");
  if (majorFilter !== null && majorFilter.length > 0) {
    tasksQuery = tasksQuery.in("major", majorFilter);
  }
  const { data: tasks } = await tasksQuery.returns<TaskRow[]>();
  const taskMap = Object.fromEntries((tasks ?? []).map((t) => [t.id, t]));
  const taskIds = (tasks ?? []).map((t) => t.id);

  // Fetch submissions
  let submissions: SubmissionExportRow[] = [];
  if (taskIds.length > 0) {
    const { data } = await supabase
      .from("submissions")
      .select("id, task_id, user_id, content, link_url, file_name, submitted_at, review_status, score, admin_feedback, reviewed_at, version")
      .in("task_id", taskIds)
      .order("submitted_at", { ascending: false })
      .returns<SubmissionExportRow[]>();
    submissions = data ?? [];
  } else if (majorFilter === null) {
    const { data } = await supabase
      .from("submissions")
      .select("id, task_id, user_id, content, link_url, file_name, submitted_at, review_status, score, admin_feedback, reviewed_at, version")
      .order("submitted_at", { ascending: false })
      .returns<SubmissionExportRow[]>();
    submissions = data ?? [];
  }

  // Fetch student profiles
  const userIds = Array.from(new Set(submissions.map((s) => s.user_id)));
  let profileMap: Record<string, ProfileRow> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, major")
      .in("id", userIds)
      .returns<ProfileRow[]>();
    profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }

  // Build CSV
  const headers = [
    "submission_id",
    "student_name",
    "student_major",
    "task_title",
    "task_major",
    "review_status",
    "score",
    "version",
    "submitted_at",
    "reviewed_at",
    "feedback",
    "has_text",
    "has_link",
    "has_file",
  ];

  const rows = submissions.map((s) => {
    const task = taskMap[s.task_id];
    const profile = profileMap[s.user_id];
    return [
      s.id,
      profile?.full_name ?? "",
      profile?.major ?? "",
      task?.title ?? "",
      task?.major ?? "",
      s.review_status ?? "pending",
      s.score ?? "",
      s.version ?? 1,
      formatDate(s.submitted_at),
      formatDate(s.reviewed_at),
      s.admin_feedback ?? "",
      s.content ? "yes" : "no",
      s.link_url ? "yes" : "no",
      s.file_name ? "yes" : "no",
    ].map((v) => escapeCSV(v === null || v === undefined ? null : String(v))).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
