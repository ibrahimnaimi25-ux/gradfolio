import { MAJOR_NAMES } from "@/lib/majors";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetch major names from the `majors` table.
 * Falls back to the static MAJOR_NAMES list if the table is empty or missing.
 */
export async function getMajorNames(
  supabase: SupabaseClient
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("majors")
      .select("name")
      .order("name", { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((row: { name: string }) => row.name);
    }
  } catch {
    // table may not exist yet — degrade gracefully
  }
  return [...MAJOR_NAMES];
}
