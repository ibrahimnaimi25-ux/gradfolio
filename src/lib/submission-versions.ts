import type { SupabaseClient } from "@supabase/supabase-js";

export type SubmissionVersionRow = {
  id: string;
  submission_id: string;
  version: number;
  content: string | null;
  link_url: string | null;
  file_name: string | null;
  file_url: string | null;
  snapshot_at: string;
};

/**
 * Snapshot the current state of a submission row into `submission_versions`
 * before it is overwritten by an update. Best-effort: failures are swallowed
 * so the main update path isn't blocked by a missing table during migration
 * rollout.
 */
export async function snapshotSubmissionVersion(
  supabase: SupabaseClient,
  submissionId: string
): Promise<void> {
  try {
    const { data: current } = await supabase
      .from("submissions")
      .select(
        "id, version, content, link_url, file_name, file_path, file_url, file_type, file_size, submitted_at"
      )
      .eq("id", submissionId)
      .maybeSingle<{
        id: string;
        version: number | null;
        content: string | null;
        link_url: string | null;
        file_name: string | null;
        file_path: string | null;
        file_url: string | null;
        file_type: string | null;
        file_size: number | null;
        submitted_at: string | null;
      }>();

    if (!current) return;

    await supabase.from("submission_versions").insert({
      submission_id: submissionId,
      version: current.version ?? 1,
      content: current.content,
      link_url: current.link_url,
      file_name: current.file_name,
      file_path: current.file_path,
      file_url: current.file_url,
      file_type: current.file_type,
      file_size: current.file_size,
      snapshot_of: current.submitted_at,
    });
  } catch {
    // Table may not exist yet; skip silently.
  }
}
