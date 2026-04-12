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

  const payload = {
    full_name: formData.get("full_name")?.toString().trim() || null,
    headline: formData.get("headline")?.toString().trim() || null,
    bio: formData.get("bio")?.toString().trim() || null,
    major: formData.get("major")?.toString().trim() || null,
    skills: formData.get("skills")?.toString().trim() || null,
    linkedin_url: formData.get("linkedin_url")?.toString().trim() || null,
    github_url: formData.get("github_url")?.toString().trim() || null,
    behance_url: formData.get("behance_url")?.toString().trim() || null,
    website_url: formData.get("website_url")?.toString().trim() || null,
    resume_link: formData.get("resume_link")?.toString().trim() || null,
  };

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id);

  if (error) {
    redirect(
      `/students/${user.id}/edit?error=${encodeURIComponent(error.message)}`
    );
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
