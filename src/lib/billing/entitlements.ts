// Monetization hook — isolated on purpose.
//
// Every feature that will eventually be gated should ask this helper,
// not read `plan` columns directly. Today it always returns true, so
// no feature is blocked. When billing ships we flip this to consult
// plan_entitlements + usage_events. Call sites won't change.

import type { SupabaseClient } from "@supabase/supabase-js";

export type EntitlementSubject =
  | { type: "user"; id: string }
  | { type: "organization"; id: string };

export type FeatureKey =
  | "tasks.create"
  | "tasks.unlimited"
  | "jobs.create"
  | "jobs.unlimited"
  | "discover.contact"
  | "certificates.issue"
  | "events.host"
  | "analytics.advanced";

export type EntitlementResult = {
  allowed: boolean;
  reason?: string;
  remaining?: number | null;
};

/**
 * Returns whether `subject` is allowed to use `feature`.
 * Phase 9: free-for-all. This is the single call site to change later.
 */
export async function hasEntitlement(
  _supabase: SupabaseClient,
  _subject: EntitlementSubject,
  _feature: FeatureKey,
): Promise<EntitlementResult> {
  return { allowed: true, remaining: null };
}

/**
 * Fire-and-forget usage counter. Safe to call in server actions.
 * Never throws — monetization telemetry must never break product flows.
 */
export async function recordUsage(
  supabase: SupabaseClient,
  subject: EntitlementSubject,
  eventKey: string,
  amount = 1,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from("usage_events").insert({
      subject_type: subject.type,
      subject_id: subject.id,
      event_key: eventKey,
      amount,
      metadata,
    });
  } catch {
    // swallow
  }
}
