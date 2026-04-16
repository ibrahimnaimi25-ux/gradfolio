// ─── DB migration required ────────────────────────────────────────────────────
// Run in your Supabase SQL editor:
//
//   CREATE TABLE IF NOT EXISTS audit_logs (
//     id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
//     action     text NOT NULL,
//     entity_type text,
//     entity_id  text,
//     metadata   jsonb,
//     created_at timestamptz DEFAULT now()
//   );
//
//   CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx   ON audit_logs(user_id);
//   CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@/lib/supabase/server";

type LogAuditArgs = {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Fire-and-forget audit logging. Never throws — errors are swallowed so they
 * never block the main operation that called this.
 *
 * Usage:
 *   await logAudit({ userId, action: "submission.created", entityType: "submission", entityId: sub.id });
 */
export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  metadata,
}: LogAuditArgs): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      metadata: metadata ?? null,
    });
  } catch {
    // Best-effort — never block main operations
  }
}
