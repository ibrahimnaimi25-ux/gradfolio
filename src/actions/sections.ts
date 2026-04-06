"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSections() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sections")
    .select("*, tasks(count)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data.map((s: any) => ({
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
    .select("id, title, description, status, major, assignment_type, submission_type")
    .eq("section_id", id)
    .order("created_at", { ascending: true });

  return { section, tasks: tasks ?? [] };
}

export async function createSection(formData: FormData) {
  const supabase = await createClient();

  const payload = {
    name: formData.get("name") as string,
    major: formData.get("major") as string,
    description: (formData.get("description") as string) || null,
  };

  const { error } = await supabase.from("sections").insert([payload]);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/sections");
  revalidatePath("/tasks");
}

export async function updateSection(id: string, formData: FormData) {
  const supabase = await createClient();

  const payload = {
    name: formData.get("name") as string,
    major: formData.get("major") as string,
    description: (formData.get("description") as string) || null,
  };

  const { error } = await supabase
    .from("sections")
    .update(payload)
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/sections");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/sections/${id}`);
}

export async function deleteSection(id: string) {
  const supabase = await createClient();

  // Unlink tasks before deleting so they aren't orphaned
  await supabase
    .from("tasks")
    .update({ section_id: null })
    .eq("section_id", id);

  const { error } = await supabase.from("sections").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/sections");
  revalidatePath("/tasks");
}
