"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function uploadResume(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/dashboard?resume_error=${encodeURIComponent("Please select a PDF file")}`
    );
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    redirect(
      `/dashboard?resume_error=${encodeURIComponent("Only PDF files are allowed")}`
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    redirect(
      `/dashboard?resume_error=${encodeURIComponent("File exceeds the 5 MB limit")}`
    );
  }

  // Remove old resume from storage if one already exists
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("resume_path")
      .eq("id", user.id)
      .maybeSingle<{ resume_path: string | null }>();
    if (existing?.resume_path) {
      await supabase.storage.from("resumes").remove([existing.resume_path]);
    }
  } catch {
    // ignore — old file cleanup is best-effort
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/${Date.now()}-${safeName}`;

  // Pass the File object directly — Supabase JS v2 accepts File/Blob natively.
  // Never convert to Buffer here: Buffer is not reliably available in
  // Next.js 16 Turbopack server-action bundles and causes an unhandled crash.
  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(storagePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    redirect(
      `/dashboard?resume_error=${encodeURIComponent(uploadError.message)}`
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("resumes").getPublicUrl(storagePath);

  // Persist the reference. If columns don't exist yet this returns an error —
  // roll back the storage upload so the user gets a clear message.
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      resume_url: publicUrl,
      resume_name: file.name,
      resume_path: storagePath,
    })
    .eq("id", user.id);

  if (updateError) {
    await supabase.storage.from("resumes").remove([storagePath]);
    redirect(
      `/dashboard?resume_error=${encodeURIComponent(
        "Could not save resume — " + updateError.message
      )}`
    );
  }

  redirect("/dashboard?resume_success=1");
}

export async function removeResume(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const path = formData.get("resume_path")?.toString() ?? "";
  if (path) {
    await supabase.storage.from("resumes").remove([path]);
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ resume_url: null, resume_name: null, resume_path: null })
    .eq("id", user.id);

  if (updateError) {
    redirect(
      `/dashboard?resume_error=${encodeURIComponent(
        "Could not remove resume — " + updateError.message
      )}`
    );
  }

  redirect("/dashboard");
}
