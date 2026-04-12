"use client";

import { useRef } from "react";
import { uploadAvatar, removeAvatar } from "@/app/students/[id]/actions";

interface AvatarFormProps {
  avatarUrl: string | null;
  fullName: string | null;
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AvatarForm({ avatarUrl, fullName }: AvatarFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Preview */}
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="Profile photo"
          className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white shadow">
          {getInitials(fullName)}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {/* Upload new photo — auto-submits on file select */}
        <form ref={formRef} action={uploadAvatar} className="flex items-center gap-2">
          <label
            htmlFor="avatar-input"
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300"
          >
            Choose photo
            <input
              id="avatar-input"
              name="avatar"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                if (e.currentTarget.files?.length) {
                  formRef.current?.requestSubmit();
                }
              }}
            />
          </label>
          <span className="text-xs text-slate-400">JPG, PNG or WebP · max 2 MB</span>
        </form>

        {/* Remove photo */}
        {avatarUrl && (
          <form action={removeAvatar}>
            <input type="hidden" name="avatar_url" value={avatarUrl} />
            <button
              type="submit"
              className="text-xs font-medium text-red-500 transition hover:text-red-700"
            >
              Remove photo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
