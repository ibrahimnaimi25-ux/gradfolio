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
}

export function MajorSectionSelect({
  majorNames,
  sections,
  defaultMajor,
  defaultSectionId,
  inputClass,
  labelClass,
}: Props) {
  const [selectedMajor, setSelectedMajor] = useState(defaultMajor ?? "");

  const filteredSections = selectedMajor
    ? sections.filter((s) => s.major === selectedMajor)
    : [];

  return (
    <>
      <div>
        <label className={labelClass}>Major</label>
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
      </div>
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
            No sections for {selectedMajor} yet — create one in Manage Sections first.
          </p>
        )}
      </div>
    </>
  );
}
