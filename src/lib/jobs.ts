import type { SupabaseClient } from "@supabase/supabase-js";

export type JobPostRow = {
  id: string;
  org_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: string;
  required_task_id: string | null;
  min_score: number | null;
  salary_text: string | null;
  majors: string[] | null;
  status: "open" | "closed" | "archived";
  deadline: string | null;
  created_at: string;
  closed_at: string | null;
};

export type QualifyingSubmission = {
  id: string;
  task_id: string;
  score: number | null;
  review_status: string | null;
  submitted_at: string | null;
};

/**
 * Returns the most recent APPROVED submission from `userId` for the job's
 * required task that also meets `min_score`. Returns null if the student
 * doesn't qualify. If the job has no `required_task_id`, returns a sentinel
 * `{ id: "__no_gate__", ... }` so callers know they qualify without a
 * specific submission.
 */
export async function findQualifyingSubmission(
  supabase: SupabaseClient,
  userId: string,
  job: Pick<JobPostRow, "required_task_id" | "min_score">
): Promise<QualifyingSubmission | null> {
  // No gate — anyone qualifies
  if (!job.required_task_id) {
    return {
      id: "__no_gate__",
      task_id: "",
      score: null,
      review_status: null,
      submitted_at: null,
    };
  }

  const { data } = await supabase
    .from("submissions")
    .select("id, task_id, score, review_status, submitted_at")
    .eq("user_id", userId)
    .eq("task_id", job.required_task_id)
    .eq("review_status", "approved")
    .order("submitted_at", { ascending: false })
    .returns<QualifyingSubmission[]>();

  const submissions = data ?? [];
  if (submissions.length === 0) return null;

  // If min_score is required, filter further
  if (job.min_score != null) {
    const meeting = submissions.find(
      (s) => s.score != null && s.score >= (job.min_score as number)
    );
    return meeting ?? null;
  }

  return submissions[0];
}

/**
 * Bulk-checks qualification for many jobs for one user. Single round-trip to DB.
 * Returns a map of job_id → QualifyingSubmission | null.
 */
export async function findQualifyingSubmissionsForJobs(
  supabase: SupabaseClient,
  userId: string,
  jobs: Pick<JobPostRow, "id" | "required_task_id" | "min_score">[]
): Promise<Record<string, QualifyingSubmission | null>> {
  const result: Record<string, QualifyingSubmission | null> = {};

  const gatedJobs = jobs.filter((j) => !!j.required_task_id);
  const taskIds = Array.from(new Set(gatedJobs.map((j) => j.required_task_id as string)));

  // Jobs with no gate → auto-qualify
  for (const j of jobs) {
    if (!j.required_task_id) {
      result[j.id] = {
        id: "__no_gate__",
        task_id: "",
        score: null,
        review_status: null,
        submitted_at: null,
      };
    }
  }

  if (taskIds.length === 0) return result;

  const { data } = await supabase
    .from("submissions")
    .select("id, task_id, score, review_status, submitted_at")
    .eq("user_id", userId)
    .eq("review_status", "approved")
    .in("task_id", taskIds)
    .order("submitted_at", { ascending: false })
    .returns<QualifyingSubmission[]>();

  const byTask: Record<string, QualifyingSubmission[]> = {};
  for (const s of data ?? []) {
    (byTask[s.task_id] ||= []).push(s);
  }

  for (const j of gatedJobs) {
    const subs = byTask[j.required_task_id as string] ?? [];
    if (subs.length === 0) {
      result[j.id] = null;
      continue;
    }
    if (j.min_score != null) {
      const meeting = subs.find(
        (s) => s.score != null && s.score >= (j.min_score as number)
      );
      result[j.id] = meeting ?? null;
    } else {
      result[j.id] = subs[0];
    }
  }

  return result;
}
