import type { SupabaseClient } from "@supabase/supabase-js";

export type SectionProgress = {
  done: number;    // tasks with at least one submission
  total: number;   // total tasks in section
  approved: number; // tasks with at least one approved submission
  avg_score: number | null; // mean of approved scores (null if no scored approvals)
};

export type OverallProgress = {
  tasks_total: number;
  tasks_submitted: number;
  tasks_approved: number;
  avg_score: number | null;
};

/**
 * Returns a per-section progress map for a single student.
 * Runs exactly 2 queries regardless of section / task count.
 *
 * "done" = tasks that have at least one submission (pending review counts too —
 * the student did the work; waiting on staff is not their fault).
 */
export async function getSectionProgressMap(
  supabase: SupabaseClient,
  userId: string,
  sectionIds: string[]
): Promise<Record<string, SectionProgress>> {
  if (sectionIds.length === 0) return {};

  // Query 1 — only OPEN tasks (draft + closed don't count toward progress)
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, section_id")
    .in("section_id", sectionIds)
    .eq("status", "open")
    .returns<Array<{ id: string; section_id: string }>>();

  const taskList = tasks ?? [];
  const taskIds = taskList.map((t) => t.id);

  // section → Set<taskId>
  const sectionTaskIds: Record<string, Set<string>> = {};
  for (const t of taskList) {
    if (!sectionTaskIds[t.section_id]) sectionTaskIds[t.section_id] = new Set();
    sectionTaskIds[t.section_id].add(t.id);
  }

  // Query 2 — which of those tasks has the student submitted + scored?
  const submittedIds = new Set<string>();
  const approvedByTask: Record<string, number[]> = {};
  if (taskIds.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("task_id, review_status, score")
      .eq("user_id", userId)
      .in("task_id", taskIds)
      .returns<Array<{ task_id: string; review_status: string | null; score: number | null }>>();

    for (const s of subs ?? []) {
      submittedIds.add(s.task_id);
      if (s.review_status === "approved" && typeof s.score === "number") {
        (approvedByTask[s.task_id] ||= []).push(s.score);
      }
    }
  }

  // Build result
  const result: Record<string, SectionProgress> = {};
  for (const [sectionId, ids] of Object.entries(sectionTaskIds)) {
    const total = ids.size;
    const arr = [...ids];
    const done = arr.filter((id) => submittedIds.has(id)).length;
    const approved = arr.filter((id) => (approvedByTask[id] ?? []).length > 0).length;

    // Take the best score per task (most recent approved review wins? use max)
    const perTaskBest: number[] = [];
    for (const id of arr) {
      const scores = approvedByTask[id];
      if (scores && scores.length > 0) perTaskBest.push(Math.max(...scores));
    }
    const avg_score =
      perTaskBest.length > 0
        ? perTaskBest.reduce((a, b) => a + b, 0) / perTaskBest.length
        : null;

    result[sectionId] = { done, total, approved, avg_score };
  }

  // Sections with 0 tasks still need an entry so callers don't have to null-check
  for (const id of sectionIds) {
    if (!result[id]) result[id] = { done: 0, total: 0, approved: 0, avg_score: null };
  }

  return result;
}

/**
 * Overall progress across all of a student's submissions (for dashboard header
 * and public portfolio). Single query.
 */
export async function getOverallProgress(
  supabase: SupabaseClient,
  userId: string,
  major: string | null
): Promise<OverallProgress> {
  // Count of open tasks in their major (baseline total)
  let tasksTotal = 0;
  if (major) {
    const { count } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("major", major)
      .eq("status", "open");
    tasksTotal = count ?? 0;
  }

  const { data: subs } = await supabase
    .from("submissions")
    .select("task_id, review_status, score")
    .eq("user_id", userId)
    .returns<Array<{ task_id: string; review_status: string | null; score: number | null }>>();

  const submittedTasks = new Set<string>();
  const approvedByTask: Record<string, number[]> = {};
  for (const s of subs ?? []) {
    submittedTasks.add(s.task_id);
    if (s.review_status === "approved" && typeof s.score === "number") {
      (approvedByTask[s.task_id] ||= []).push(s.score);
    }
  }

  const approvedTaskIds = Object.keys(approvedByTask);
  const perTaskBest = approvedTaskIds.map((id) => Math.max(...approvedByTask[id]));
  const avg_score =
    perTaskBest.length > 0 ? perTaskBest.reduce((a, b) => a + b, 0) / perTaskBest.length : null;

  return {
    tasks_total: tasksTotal,
    tasks_submitted: submittedTasks.size,
    tasks_approved: approvedTaskIds.length,
    avg_score,
  };
}
