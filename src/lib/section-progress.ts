import type { SupabaseClient } from "@supabase/supabase-js";

export type SectionProgress = {
  done: number;  // sections with at least one submission
  total: number; // total tasks in section
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

  // Query 2 — which of those tasks has the student submitted?
  const submittedIds = new Set<string>();
  if (taskIds.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("task_id")
      .eq("user_id", userId)
      .in("task_id", taskIds)
      .returns<Array<{ task_id: string }>>();

    for (const s of subs ?? []) submittedIds.add(s.task_id);
  }

  // Build result
  const result: Record<string, SectionProgress> = {};
  for (const [sectionId, ids] of Object.entries(sectionTaskIds)) {
    const total = ids.size;
    const done = [...ids].filter((id) => submittedIds.has(id)).length;
    result[sectionId] = { done, total };
  }

  // Sections with 0 tasks still need an entry so callers don't have to null-check
  for (const id of sectionIds) {
    if (!result[id]) result[id] = { done: 0, total: 0 };
  }

  return result;
}
