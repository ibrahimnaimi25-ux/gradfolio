import { getSectionsForStaff } from "@/actions/sections";
import { requireStaff, getMajorFilter, getMajorLabel } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMajorNames } from "@/lib/majors-db";
import SectionFormDialog from "@/components/admin/SectionFormDialog";
import SectionAdminTable from "@/components/admin/SectionAdminTable";

export const metadata = { title: "Manage Sections | GradFolio" };

export default async function AdminSectionsPage() {
  const { profile } = await requireStaff();
  const majorFilter = getMajorFilter(profile);
  const isManager = profile.role === "manager";
  const supabase = await createClient();
  const majorNames = await getMajorNames(supabase);

  const sections = await getSectionsForStaff();

  const totalTasks = sections.reduce((acc: number, s: any) => acc + s.task_count, 0);
  const uniqueMajors = new Set(sections.map((s: any) => s.major)).size;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-1">
            {isManager ? `Manager — ${getMajorLabel(profile)}` : "Super Admin"}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Sections</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isManager
              ? `Manage sections for ${getMajorLabel(profile) || "your major"}.`
              : "Manage all course sections across every major."}
          </p>
        </div>
        <SectionFormDialog
          mode="create"
          restrictedMajor={majorFilter !== null && majorFilter.length === 1 ? majorFilter[0] : undefined}
          availableMajors={majorFilter !== null && majorFilter.length > 0 ? majorFilter : majorNames}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Sections", value: sections.length },
          { label: "Total Tasks", value: totalTasks },
          {
            label: isManager ? "Your Major" : "Unique Majors",
            value: isManager ? (getMajorLabel(profile) || "—") : uniqueMajors,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-gray-200 rounded-xl p-5"
          >
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              {stat.label}
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <SectionAdminTable
          sections={sections}
          restrictedMajor={majorFilter !== null && majorFilter.length === 1 ? majorFilter[0] : undefined}
          availableMajors={majorFilter !== null && majorFilter.length > 0 ? majorFilter : majorNames}
        />
      </div>
    </div>
  );
}
