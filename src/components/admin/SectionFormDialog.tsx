"use client";

import { useRef, useState, useTransition } from "react";
import { createSection, updateSection } from "@/actions/sections";
import type { Section } from "@/types/sections";

interface Props {
  mode: "create" | "edit";
  section?: Section;
}

export default function SectionFormDialog({ mode, section }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createSection(fd);
        } else if (section) {
          await updateSection(section.id, fd);
        }
        setOpen(false);
        formRef.current?.reset();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          mode === "create"
            ? "bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
            : "text-sm text-indigo-600 hover:underline"
        }
      >
        {mode === "create" ? "+ New Section" : "Edit"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                {mode === "create" ? "New Section" : "Edit Section"}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Section Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  required
                  defaultValue={section?.name}
                  placeholder="e.g. CS 301 — Algorithms"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Major <span className="text-red-500">*</span>
                </label>
                <input
                  name="major"
                  required
                  defaultValue={section?.major}
                  placeholder="e.g. Computer Science"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={section?.description ?? ""}
                  placeholder="Brief description of this section…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {isPending
                    ? "Saving…"
                    : mode === "create"
                    ? "Create Section"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
