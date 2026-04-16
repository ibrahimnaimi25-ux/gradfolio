import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Audit Log | GradFolio" };

type AuditRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type SearchParams = Promise<{ q?: string; action?: string }>;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function actionBadgeClass(action: string) {
  if (action.startsWith("submission")) return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100";
  if (action.startsWith("task")) return "bg-violet-50 text-violet-700 ring-1 ring-violet-100";
  if (action.startsWith("role") || action.startsWith("manager")) return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-slate-100 text-slate-600";
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").toLowerCase().trim();
  const actionFilter = params.action ?? "";

  await requireSuperAdmin();
  const supabase = await createClient();

  let logs: AuditRow[] = [];
  let userMap: Record<string, string> = {};
  let distinctActions: string[] = [];

  try {
    const { data } = await supabase
      .from("audit_logs")
      .select("id, user_id, action, entity_type, entity_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<AuditRow[]>();
    logs = data ?? [];

    // Distinct action types for filter
    distinctActions = Array.from(new Set(logs.map((l) => l.action))).sort();

    // Build user name map
    const userIds = Array.from(new Set(logs.map((l) => l.user_id).filter(Boolean) as string[]));
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds)
        .returns<{ id: string; full_name: string | null }[]>();
      userMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p.full_name ?? `User ${p.id.slice(0, 8)}`])
      );
    }
  } catch {
    // Table may not exist yet
  }

  // Filter
  const filtered = logs.filter((l) => {
    const matchesAction = !actionFilter || l.action === actionFilter;
    const matchesQ =
      !q ||
      l.action.includes(q) ||
      (l.entity_type ?? "").includes(q) ||
      (l.entity_id ?? "").includes(q) ||
      (l.user_id ? (userMap[l.user_id] ?? "").toLowerCase().includes(q) : false);
    return matchesAction && matchesQ;
  });

  return (
    <main className="min-h-screen pb-24 pt-10">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-6 space-y-6">

        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Super Admin</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Audit Log</h1>
          <p className="mt-3 text-base text-slate-500">
            Platform activity log — last 500 events across all users and entities.
          </p>
        </section>

        {/* Filters */}
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <form className="flex flex-wrap gap-3">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search action, user, entity…"
              className="flex-1 min-w-48 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <select
              name="action"
              defaultValue={actionFilter}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">All actions</option>
              {distinctActions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Filter
            </button>
            {(q || actionFilter) && (
              <a
                href="/admin/audit-log"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Clear
              </a>
            )}
          </form>
        </section>

        {/* Table */}
        {logs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center">
            <div className="mb-3 text-4xl">📋</div>
            <p className="text-base font-semibold text-slate-700">No audit logs yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Events will appear here once the audit_logs table is created and activity occurs.
            </p>
          </div>
        ) : (
          <section className="rounded-3xl border border-black/5 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">
                {filtered.length} event{filtered.length !== 1 ? "s" : ""}
                {(q || actionFilter) && " (filtered)"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Entity</th>
                    <th className="px-6 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-6 py-3 text-slate-700 whitespace-nowrap">
                        {log.user_id ? (userMap[log.user_id] ?? `…${log.user_id.slice(-6)}`) : "—"}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${actionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-500 whitespace-nowrap text-xs">
                        {log.entity_type && (
                          <span>{log.entity_type}</span>
                        )}
                        {log.entity_id && (
                          <span className="ml-1 text-slate-400">#{log.entity_id.slice(0, 8)}</span>
                        )}
                        {!log.entity_type && !log.entity_id && "—"}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-400 max-w-xs truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
