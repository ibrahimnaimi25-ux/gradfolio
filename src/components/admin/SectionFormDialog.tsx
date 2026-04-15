"use client";

import { useRef, useState, useTransition } from "react";
import { createSection, updateSection } from "@/actions/sections";
import type { Section } from "@/types/sections";
import { MAJOR_NAMES } from "@/lib/majors";

interface Props {
  mode: "create" | "edit";
  section?: Section;
  /**
   * When set, the major dropdown is replaced by a locked badge.
   * Passed down from the sections page for managers.
   */
  restrictedMajor?: string;
  /** Major names fetched from DB by the server page. Falls back to static list. */
  availableMajors?: string[];
}

const inputClass =
  "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition";

export default function SectionFormDialog({ mode, section, restrictedMajor, availableMajors }: Props) {
  const majorOptions = availableMajors && availableMajors.length > 0 ? availableMajors : MAJOR_NAMES;
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
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  // Resolved major: locked for managers, or existing section major for edits
  const resolvedLockedMajor = restrictedMajor ?? (mode === "edit" && section?.major ? undefined : undefined);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          mode === "create"
            ? "bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
            : "text-sm text-indigo-600 hover:underline"
        }
      >
        {mode === "create" ? "+ New Section" : "Edit"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {mode === "create" ? "New Section" : "Edit Section"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sections group tasks within a major.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
              >
                ×
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Section Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  required
                  defaultValue={section?.name}
                  placeholder="e.g. Risk Assessment"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Major <span className="text-red-500">*</span>
                </label>

                {/* Locked major badge for managers */}
                {restrictedMajor ? (
                  <>
                    <input type="hidden" name="major" value={restrictedMajor} />
                    <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-700">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                      <span className="font-medium">{restrictedMajor}</span>
                      <span className="ml-auto text-xs text-indigo-400">Your major</span>
                    </div>
                  </>
                ) : (
                  <>
                    <select
                      name="major"
                      required
                      defaultValue={section?.major ?? ""}
                      className={inputClass}
                    >
                      <option value="">Select a major</option>
                      {majorOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-400">
                      Only existing majors are allowed. Admins can add new ones in{" "}
                      <a href="/admin/majors" className="underline hover:text-indigo-600">Majors</a>.
                    </p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={section?.description ?? ""}
                  placeholder="Brief description of what this section covers…"
                  className={`${inputClass} resize-none`}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
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
