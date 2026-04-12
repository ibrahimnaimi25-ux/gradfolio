"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileId = formData.get("profile_id")?.toString() ?? "";
  if (profileId !== user.id) redirect(`/students/${profileId}`);

  const str = (key: string) =>
    formData.get(key)?.toString().trim() || null;

  // Step 1 — always-present columns (guaranteed to exist)
  const { error: baseError } = await supabase
    .from("profiles")
    .update({ full_name: str("full_name"), major: str("major") })
    .eq("id", user.id);

  if (baseError) {
    redirect(
      `/students/${user.id}/edit?error=${encodeURIComponent(baseError.message)}`
    );
  }

  // Step 2 — optional columns; skip gracefully if column doesn't exist yet
  const optionalFields: Record<string, string | null> = {
    bio:          str("bio"),
    headline:     str("headline"),
    skills:       str("skills"),
    linkedin_url: str("linkedin_url"),
    github_url:   str("github_url"),
    behance_url:  str("behance_url"),
    website_url:  str("website_url"),
    resume_link:  str("resume_link"),
  };

  // Try all optional fields together first (fast path after migration)
  const { error: optError } = await supabase
    .from("profiles")
    .update(optionalFields)
    .eq("id", user.id);

  // If bulk optional update fails (missing column), fall back field-by-field
  if (optError) {
    for (const [col, val] of Object.entries(optionalFields)) {
      await supabase
        .from("profiles")
        .update({ [col]: val })
        .eq("id", user.id);
      // ignore per-column errors — column may not exist yet
    }
  }

  revalidatePath(`/students/${user.id}`);
  revalidatePath(`/students/${user.id}/edit`);
  redirect(`/students/${user.id}?saved=1`);
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/students/${user.id}/edit?error=${encodeURIComponent("Please select an image file")}`
    );
  }

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    redirect(
      `/students/${user.id}/edit?error=${encodeURIComponent(
        "Only JPG, PNG, or WebP images are allowed"
      )}`
    );
  }

  if (file.size > 2 * 1024 * 1024) {
    redirect(
      `/students/${user.id}/edit?error=${encodeURIComponent(
        "Image exceeds the 2 MB limit"
      )}`
    );
  }

  // Remove old avatar from storage
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle<{ avatar_url: string | null }>();
    if (existing?.avatar_url) {
      const parts = existing.avatar_url.split("/avatars/");
      if (parts.length > 1) {
        await supabase.storage
          .from("avatars")
          .remove([decodeURIComponent(parts[1].split("?")[0])]);
      }
    }
  } catch {
    // ignore — cleanup is best-effort
  }

  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
  };
  const ext = extMap[file.type] ?? "jpg";
  const storagePath = `${user.id}/${Date.now()}.${ext}`;

  // Pass File directly — Supabase JS v2 accepts File/Blob natively
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    redirect(
      `/students/${user.id}/edit?error=${encodeURIComponent(uploadError.message)}`
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(storagePath);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateError) {
    await supabase.storage.from("avatars").remove([storagePath]);
    redirect(
      `/students/${user.id}/edit?error=${encodeURIComponent(updateError.message)}`
    );
  }

  revalidatePath(`/students/${user.id}`);
  revalidatePath(`/students/${user.id}/edit`);
  redirect(`/students/${user.id}/edit?photo=saved`);
}

export async function removeAvatar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const avatarUrl = formData.get("avatar_url")?.toString() ?? "";
  if (avatarUrl) {
    try {
      const parts = avatarUrl.split("/avatars/");
      if (parts.length > 1) {
        await supabase.storage
          .from("avatars")
          .remove([decodeURIComponent(parts[1].split("?")[0])]);
      }
    } catch {
      // ignore
    }
  }

  await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  revalidatePath(`/students/${user.id}`);
  revalidatePath(`/students/${user.id}/edit`);
  redirect(`/students/${user.id}/edit`);
}
