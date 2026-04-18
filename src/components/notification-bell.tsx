import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/notifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Server-rendered bell icon + dropdown. Dropdown state is managed via native
 * <details>/<summary> so no client JS is needed.
 *
 * Renders nothing for guests.
 */
export default async function NotificationBell() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [unread, recent] = await Promise.all([
    getUnreadNotificationCount(supabase, user.id),
    getRecentNotifications(supabase, user.id, 10),
  ]);

  return (
    <details className="relative">
      <summary
        className="relative flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <svg
          className="h-4.5 w-4.5 text-slate-600"
          width="18"
          height="18"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0h6z"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </summary>

      <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-black/5 z-50">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          {unread > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                Mark all read
              </button>
            </form>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {recent.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No notifications yet</p>
              <p className="mt-1 text-xs text-slate-400">
                You&apos;ll hear from us when things happen.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((n) => {
                const isUnread = !n.read_at;
                const markRead = markNotificationRead.bind(null, n.id);
                return (
                  <li
                    key={n.id}
                    className={isUnread ? "bg-indigo-50/40" : "bg-white"}
                  >
                    <div className="flex items-start gap-2 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        {n.link ? (
                          <Link
                            href={n.link}
                            className="block hover:underline"
                          >
                            <p
                              className={`text-sm ${
                                isUnread
                                  ? "font-semibold text-slate-900"
                                  : "text-slate-700"
                              }`}
                            >
                              {n.title}
                            </p>
                          </Link>
                        ) : (
                          <p
                            className={`text-sm ${
                              isUnread
                                ? "font-semibold text-slate-900"
                                : "text-slate-700"
                            }`}
                          >
                            {n.title}
                          </p>
                        )}
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-400">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                      {isUnread && (
                        <form action={markRead} className="shrink-0">
                          <button
                            type="submit"
                            aria-label="Mark as read"
                            title="Mark as read"
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            ●
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
