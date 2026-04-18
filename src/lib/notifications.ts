import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType =
  | "submission_reviewed"
  | "company_interest"
  | "application_status"
  | "job_qualified"
  | "generic";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * Fire-and-forget notification creator. Never throws — if the table is missing
 * or the write fails, we swallow silently so the caller's primary action isn't
 * interrupted.
 */
export async function createNotification(
  supabase: SupabaseClient,
  params: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
  }
): Promise<void> {
  try {
    await supabase.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    });
  } catch {
    // swallow
  }
}

export async function getUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  try {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getRecentNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 10
): Promise<NotificationRow[]> {
  try {
    const { data } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, body, link, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<NotificationRow[]>();
    return data ?? [];
  } catch {
    return [];
  }
}
