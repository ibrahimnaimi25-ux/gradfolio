import { getSections } from "@/actions/sections";
import SectionFormDialog from "@/components/admin/SectionFormDialog";
import SectionAdminTable from "@/components/admin/SectionAdminTable";

export const metadata = { title: "Manage Sections | GradFolio Admin" };

export default async function AdminSectionsPage() {
  const sections = await getSections();

  const totalTasks = sections.reduce((acc: number, s: any) => acc + s.task_count, 0);
  const uniqueMajors = new Set(sections.map((s: any) => s.major)).size;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sections</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage course sections and their associated tasks.
          </p>
        </div>
        <SectionFormDialog mode="create" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Sections", value: sections.length },
          { label: "Total Tasks", value: totalTasks },
          { label: "Unique Majors", value: uniqueMajors },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <SectionAdminTable sections={sections} />
      </div>
    </div>
  );
}