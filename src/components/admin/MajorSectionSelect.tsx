"use client";

import { useState } from "react";

type SectionRow = { id: string; name: string; major: string };

interface Props {
  majorNames: string[];
  sections: SectionRow[];
  defaultMajor?: string | null;
  defaultSectionId?: string | null;
  inputClass: string;
  labelClass: string;
  /**
   * When set, the major selector is replaced by a read-only badge
   * and the major value is submitted as a hidden input.
   * Used for managers who are locked to their assigned major.
   */
  lockedMajor?: string;
}

export function MajorSectionSelect({
  majorNames,
  sections,
  defaultMajor,
  defaultSectionId,
  inputClass,
  labelClass,
  lockedMajor,
}: Props) {
  const initialMajor = lockedMajor ?? defaultMajor ?? "";
  const [selectedMajor, setSelectedMajor] = useState(initialMajor);

  const filteredSections = selectedMajor
    ? sections.filter((s) => s.major === selectedMajor)
    : [];

  return (
    <>
      {/* Major selector — locked badge for managers, dropdown for admins */}
      <div>
        <label className={labelClass}>Major</label>
        {lockedMajor ? (
          <>
            <input type="hidden" name="major" value={lockedMajor} />
            <div
              className={`${inputClass} flex items-center gap-2 cursor-not-allowed opacity-75 select-none`}
            >
              <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
              <span className="font-medium text-slate-700">{lockedMajor}</span>
              <span className="ml-auto text-xs text-slate-400">Your major</span>
            </div>
          </>
        ) : (
          <select
            name="major"
            value={selectedMajor}
            onChange={(e) => setSelectedMajor(e.target.value)}
            className={inputClass}
          >
            <option value="">Select a major</option>
            {majorNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Section selector */}
      <div>
        <label className={labelClass}>Section</label>
        <select
          name="section_id"
          defaultValue={defaultSectionId ?? ""}
          className={inputClass}
          disabled={!selectedMajor}
        >
          <option value="">
            {selectedMajor ? "No section" : "Select a major first"}
          </option>
          {filteredSections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {selectedMajor && filteredSections.length === 0 && (
          <p className="mt-1.5 text-xs text-amber-600">
            No sections for {selectedMajor} yet — create one in Manage Sections
            first.
          </p>
        )}
      </div>
    </>
  );
}
