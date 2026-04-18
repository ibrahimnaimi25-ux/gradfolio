"use client";

import { useMemo, useTransition } from "react";
import { deleteSection, moveSectionUp, moveSectionDown } from "@/actions/sections";
import SectionFormDialog from "./SectionFormDialog";
import type { SectionWithTaskCount } from "@/types/sections";
import Link from "next/link";

interface Props {
  sections: SectionWithTaskCount[];
  /** Passed for managers — locks major field in the create/edit dialog. */
  restrictedMajor?: string;
  availableMajors?: string[];
}

export default function SectionAdminTable({ sections, restrictedMajor, availableMajors }: Props) {
  const [isPending, startTransition] = useTransition();

  // Within each major group, determine if a section is the first/last for
  // enabling/disabling the up/down arrows.
  const positionByMajor = useMemo(() => {
    const byMajor: Record<string, string[]> = {};
    for (const s of sections) {
      (byMajor[s.major] ||= []).push(s.id);
    }
    return byMajor;
  }, [sections]);

  function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `Delete "${name}"? Tasks in this section will be unlinked but not deleted.`
      )
    )
      return;
    startTransition(() => deleteSection(id));
  }

  function handleMove(id: string, direction: "up" | "down") {
    startTransition(() =>
      direction === "up" ? moveSectionUp(id) : moveSectionDown(id)
    );
  }

  if (sections.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📂</p>
        <p className="text-sm">No sections yet. Create your first one.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="text-left px-5 py-3 font-medium text-gray-600">Order</th>
          <th className="text-left px-5 py-3 font-medium text-gray-600">Name</th>
          <th className="text-left px-5 py-3 font-medium text-gray-600">Major</th>
          <th className="text-left px-5 py-3 font-medium text-gray-600">Tasks</th>
          <th className="text-left px-5 py-3 font-medium text-gray-600">Created</th>
          <th className="px-5 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {sections.map((section) => {
          const siblings = positionByMajor[section.major] ?? [];
          const posIdx = siblings.indexOf(section.id);
          const isFirst = posIdx === 0;
          const isLast = posIdx === siblings.length - 1;
          return (
            <tr key={section.id} className="hover:bg-gray-50 transition">
              <td className="px-5 py-3 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMove(section.id, "up")}
                    disabled={isPending || isFirst}
                    aria-label="Move section up"
                    title="Move up"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(section.id, "down")}
                    disabled={isPending || isLast}
                    aria-label="Move section down"
                    title="Move down"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              </td>
              <td className="px-5 py-3 font-medium text-gray-900">
                <Link
                  href={`/tasks/sections/${section.id}`}
                  className="hover:text-indigo-600 transition"
                >
                  {section.name}
                </Link>
              </td>
              <td className="px-5 py-3 text-gray-600">{section.major}</td>
              <td className="px-5 py-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                  {section.task_count} task{section.task_count !== 1 ? "s" : ""}
                </span>
              </td>
              <td className="px-5 py-3 text-gray-500">
                {new Date(section.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="px-5 py-3 text-right space-x-3 whitespace-nowrap">
                <SectionFormDialog
                  mode="edit"
                  section={section}
                  restrictedMajor={restrictedMajor}
                  availableMajors={availableMajors}
                />
                <button
                  onClick={() => handleDelete(section.id, section.name)}
                  disabled={isPending}
                  className="text-sm text-red-500 hover:underline disabled:opacity-40"
                >
                  Delete
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
