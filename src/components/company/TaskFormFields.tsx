"use client";

import { useMemo, useState } from "react";

type SectionOption = { id: string; name: string; major: string };

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

type Props = {
  majors: string[];
  sections: SectionOption[];
  defaultMajor?: string | null;
  defaultSectionId?: string | null;
  defaultSubmissionType?: string | null;
  defaultStatus?: string | null;
  defaultDueDate?: string | null;
};

/**
 * Shared target/meta controls for company task create & edit.
 * Keeps section options filtered to the selected major.
 */
export default function TaskFormFields({
  majors,
  sections,
  defaultMajor,
  defaultSectionId,
  defaultSubmissionType,
  defaultStatus,
  defaultDueDate,
}: Props) {
  const [major, setMajor] = useState<string>(
    defaultMajor ?? majors[0] ?? ""
  );
  const [sectionId, setSectionId] = useState<string>(defaultSectionId ?? "");

  const filteredSections = useMemo(
    () => sections.filter((s) => s.major === major),
    [sections, major]
  );

  function onMajorChange(next: string) {
    setMajor(next);
    // Reset section if it no longer belongs to the new major.
    const stillValid = sections.some(
      (s) => s.id === sectionId && s.major === next
    );
    if (!stillValid) setSectionId("");
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label htmlFor="major" className={labelClass}>
          Target Major <span className="text-rose-500">*</span>
        </label>
        <select
          id="major"
          name="major"
          required
          value={major}
          onChange={(e) => onMajorChange(e.target.value)}
          className={inputClass}
        >
          {majors.length === 0 && <option value="">No majors available</option>}
          {majors.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="section_id" className={labelClass}>
          Section <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <select
          id="section_id"
          name="section_id"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          className={inputClass}
          disabled={filteredSections.length === 0}
        >
          <option value="">
            {filteredSections.length === 0
              ? "No sections for this major"
              : "— No section —"}
          </option>
          {filteredSections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="submission_type" className={labelClass}>
          Submission Type
        </label>
        <select
          id="submission_type"
          name="submission_type"
          defaultValue={defaultSubmissionType ?? "any"}
          className={inputClass}
        >
          <option value="any">Any</option>
          <option value="text">Text</option>
          <option value="link">Link</option>
          <option value="file">File</option>
          <option value="image">Image</option>
        </select>
      </div>
      <div>
        <label htmlFor="status" className={labelClass}>
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={defaultStatus ?? "open"}
          className={inputClass}
        >
          <option value="open">Open (visible to students)</option>
          <option value="draft">Draft (hidden)</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label htmlFor="due_date" className={labelClass}>
          Due Date <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="due_date"
          name="due_date"
          type="date"
          defaultValue={defaultDueDate ?? ""}
          className={inputClass}
        />
      </div>
    </div>
  );
}
