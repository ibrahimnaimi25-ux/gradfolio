import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — server-side only.
 * Required for auth.admin.* operations (e.g. looking up user emails).
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
