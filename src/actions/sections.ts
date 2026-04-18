"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── Internal auth helper ──────────────────────────────────────────────────────
// Returns the current user's staff profile, or throws if not staff.
type InternalStaffProfile = {
  id: string;
  role: string;
  assigned_major: string | null;
  assigned_majors: string[] | null;
};

async function getStaffProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, assigned_major, assigned_majors")
    .eq("id", user.id)
    .maybeSingle<InternalStaffProfile>();

  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Unauthorized");
  }

  return { supabase, profile };
}

function getAllowedMajors(profile: InternalStaffProfile): string[] {
  if (profile.assigned_majors && profile.assigned_majors.length > 0) {
    return profile.assigned_majors;
  }
  if (profile.assigned_major) return [profile.assigned_major];
  return [];
}

// ─── Validate major access for managers ───────────────────────────────────────
function assertMajorAccess(profile: InternalStaffProfile, major: string) {
  if (profile.role !== "manager") return;
  const allowed = getAllowedMajors(profile);
  if (allowed.length > 0 && !allowed.includes(major)) {
    throw new Error(`You can only manage sections for your assigned major(s).`);
  }
}

// ─── Public actions ────────────────────────────────────────────────────────────

export async function getSections() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sections")
    .select("*, tasks(count)")
    .order("major", { ascending: true })
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return data.map((s: any) => ({
    ...s,
    task_count: s.tasks?.[0]?.count ?? 0,
  }));
}

export async function getSectionsForStaff() {
  const { supabase, profile } = await getStaffProfile();

  let query = supabase
    .from("sections")
    .select("*, tasks(count)")
    .order("major", { ascending: true })
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (profile.role === "manager") {
    const majors = getAllowedMajors(profile);
    if (majors.length > 0) {
      query = query.in("major", majors);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((s: any) => ({
    ...s,
    task_count: s.tasks?.[0]?.count ?? 0,
  }));
}

export async function getSectionById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sections")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getSectionWithTasks(id: string) {
  const supabase = await createClient();

  const { data: section, error: sErr } = await supabase
    .from("sections")
    .select("*")
    .eq("id", id)
    .single();

  if (sErr || !section) return null;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, status, major, assignment_type, submission_type, order_index")
    .eq("section_id", id)
    .order("order_index", { ascending: true, nullsFirst: true });

  return { section, tasks: tasks ?? [] };
}

export async function createSection(formData: FormData) {
  const { supabase, profile } = await getStaffProfile();

  const name = (formData.get("name") as string)?.trim();
  const major = (formData.get("major") as string)?.trim();
  const description = ((formData.get("description") as string) || "").trim() || null;

  if (!name) throw new Error("Section name is required.");
  if (!major) throw new Error("Major is required.");

  assertMajorAccess(profile, major);

  const { error } = await supabase.from("sections").insert([{ name, major, description }]);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/sections");
  revalidatePath("/tasks");
}

export async function updateSection(id: string, formData: FormData) {
  const { supabase, profile } = await getStaffProfile();

  const name = (formData.get("name") as string)?.trim();
  const major = (formData.get("major") as string)?.trim();
  const description = ((formData.get("description") as string) || "").trim() || null;

  if (!name) throw new Error("Section name is required.");
  if (!major) throw new Error("Major is required.");

  assertMajorAccess(profile, major);

  const { error } = await supabase
    .from("sections")
    .update({ name, major, description })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/sections");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/sections/${id}`);
}

export async function moveSection(id: string, direction: "up" | "down") {
  const { supabase, profile } = await getStaffProfile();

  // Find the target section so we know which major group to reorder within
  const { data: target } = await supabase
    .from("sections")
    .select("id, major, order_index")
    .eq("id", id)
    .maybeSingle<{ id: string; major: string; order_index: number | null }>();

  if (!target) throw new Error("Section not found.");
  assertMajorAccess(profile, target.major);

  // Fetch sibling sections in the same major, ordered
  const { data: siblings } = await supabase
    .from("sections")
    .select("id, order_index, created_at")
    .eq("major", target.major)
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .returns<{ id: string; order_index: number | null; created_at: string }[]>();

  if (!siblings || siblings.length < 2) return;

  // Normalize null order_index to array position
  const normalized = siblings.map((s, i) => ({ id: s.id, order_index: s.order_index ?? i }));

  const idx = normalized.findIndex((s) => s.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= normalized.length) return;

  const curr = normalized[idx];
  const swap = normalized[swapIdx];

  await Promise.all([
    supabase.from("sections").update({ order_index: swap.order_index }).eq("id", curr.id),
    supabase.from("sections").update({ order_index: curr.order_index }).eq("id", swap.id),
  ]);

  revalidatePath("/admin/sections");
  revalidatePath("/tasks");
}

export async function moveSectionUp(id: string) {
  return moveSection(id, "up");
}

export async function moveSectionDown(id: string) {
  return moveSection(id, "down");
}

export async function deleteSection(id: string) {
  const { supabase, profile } = await getStaffProfile();

  // Check the section belongs to the manager's major before deleting
  if (profile.role === "manager" && profile.assigned_major) {
    const { data: section } = await supabase
      .from("sections")
      .select("major")
      .eq("id", id)
      .maybeSingle<{ major: string }>();
    if (section) assertMajorAccess(profile, section.major);
  }

  // Unlink tasks before deleting so they aren't orphaned
  await supabase.from("tasks").update({ section_id: null }).eq("section_id", id);

  const { error } = await supabase.from("sections").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/sections");
  revalidatePath("/tasks");
}
