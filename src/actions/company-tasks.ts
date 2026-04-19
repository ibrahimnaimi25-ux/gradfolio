"use server";

import { requireCompany, requireOwnedTask } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";

/**
 * Create a new task owned by the current company.
 * Called from /company/tasks/new.
 */
export async function createCompanyTask(formData: FormData) {
  const { supabase, user, org } = await requireCompany();

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const major = String(formData.get("major") || "").trim() || null;
  const sectionId = String(formData.get("section_id") || "").trim() || null;
  const submissionType = String(formData.get("submission_type") || "any").trim();
  const dueDate = String(formData.get("due_date") || "").trim() || null;
  const status = String(formData.get("status") || "open").trim();

  if (!title) redirect("/company/tasks/new?error=Title+is+required");
  if (!major) redirect("/company/tasks/new?error=Target+major+is+required");

  // If a section was picked, validate it belongs to the selected major.
  if (sectionId) {
    const { data: section } = await supabase
      .from("sections")
      .select("id, major")
      .eq("id", sectionId)
      .maybeSingle<{ id: string; major: string }>();
    if (!section || section.major !== major) {
      redirect("/company/tasks/new?error=Section+does+not+match+the+selected+major");
    }
  }

  const { data: newTask, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description,
      major,
      section_id: sectionId,
      submission_type: submissionType,
      due_date: dueDate,
      status,
      task_source: "company",
      org_id: org.id,
      created_by: user.id,
      assignment_type: "major",
    })
    .select("id")
    .maybeSingle();

  if (error) redirect(`/company/tasks/new?error=${encodeURIComponent(error.message)}`);

  await logAudit({
    userId: user.id,
    action: "company_task.created",
    entityType: "task",
    entityId: newTask?.id,
    metadata: { title, major, section_id: sectionId },
  });

  revalidatePath("/company/tasks");
  revalidatePath("/company/dashboard");
  revalidatePath("/tasks");
  if (sectionId) revalidatePath(`/tasks/sections/${sectionId}`);
  redirect("/company/tasks?success=Task+created");
}

/**
 * Update an existing task. Ownership is enforced by requireOwnedTask.
 */
export async function updateCompanyTask(formData: FormData) {
  const taskId = String(formData.get("task_id") || "").trim();
  if (!taskId) redirect("/company/tasks?error=Missing+task+ID");

  const { supabase, user, org, task } = await requireOwnedTask(taskId);

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const major = String(formData.get("major") || "").trim() || null;
  const sectionId = String(formData.get("section_id") || "").trim() || null;
  const submissionType = String(formData.get("submission_type") || "any").trim();
  const dueDate = String(formData.get("due_date") || "").trim() || null;
  const status = String(formData.get("status") || "open").trim();

  if (!title) redirect(`/company/tasks/${taskId}?error=Title+is+required`);
  if (!major) redirect(`/company/tasks/${taskId}?error=Target+major+is+required`);

  if (sectionId) {
    const { data: section } = await supabase
      .from("sections")
      .select("id, major")
      .eq("id", sectionId)
      .maybeSingle<{ id: string; major: string }>();
    if (!section || section.major !== major) {
      redirect(`/company/tasks/${taskId}?error=Section+does+not+match+the+selected+major`);
    }
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      description,
      major,
      section_id: sectionId,
      submission_type: submissionType,
      due_date: dueDate,
      status,
    })
    .eq("id", taskId)
    .eq("org_id", org.id)
    .eq("task_source", "company");

  if (error) {
    redirect(`/company/tasks/${taskId}?error=${encodeURIComponent(error.message)}`);
  }

  await logAudit({
    userId: user.id,
    action: "company_task.updated",
    entityType: "task",
    entityId: taskId,
    metadata: { title, previous_title: task.title },
  });

  revalidatePath(`/company/tasks/${taskId}`);
  revalidatePath("/company/tasks");
  revalidatePath("/company/dashboard");
  revalidatePath("/tasks");
  if (sectionId) revalidatePath(`/tasks/sections/${sectionId}`);
  redirect(`/company/tasks/${taskId}?success=Task+updated`);
}

export async function archiveCompanyTask(formData: FormData) {
  const taskId = String(formData.get("task_id") || "").trim();
  if (!taskId) redirect("/company/tasks?error=Missing+task+ID");

  const { supabase, user, org, task } = await requireOwnedTask(taskId);

  await supabase
    .from("tasks")
    .update({ archived_at: new Date().toISOString(), status: "closed" })
    .eq("id", taskId)
    .eq("org_id", org.id);

  await logAudit({
    userId: user.id,
    action: "company_task.archived",
    entityType: "task",
    entityId: taskId,
    metadata: { title: task.title },
  });

  revalidatePath("/company/tasks");
  revalidatePath("/company/dashboard");
  revalidatePath("/tasks");
  redirect("/company/tasks?success=Task+archived");
}

export async function restoreCompanyTask(formData: FormData) {
  const taskId = String(formData.get("task_id") || "").trim();
  if (!taskId) redirect("/company/tasks?error=Missing+task+ID");

  const { supabase, user, org, task } = await requireOwnedTask(taskId);

  await supabase
    .from("tasks")
    .update({ archived_at: null, status: "open" })
    .eq("id", taskId)
    .eq("org_id", org.id);

  await logAudit({
    userId: user.id,
    action: "company_task.restored",
    entityType: "task",
    entityId: taskId,
    metadata: { title: task.title },
  });

  revalidatePath("/company/tasks");
  revalidatePath("/company/dashboard");
  revalidatePath("/tasks");
  redirect(`/company/tasks/${taskId}?success=Task+restored`);
}
