"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type SubNavItem = { href: string; label: string; icon: string };

const ITEMS: SubNavItem[] = [
  { href: "/company/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/company/tasks", label: "My Tasks", icon: "📋" },
  { href: "/company/jobs", label: "Jobs", icon: "💼" },
  { href: "/discover", label: "Discover Talent", icon: "🔍" },
  { href: "/company/profile", label: "Profile", icon: "🏢" },
];

export default function CompanySubNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-16 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 md:px-6">
        {ITEMS.map(({ href, label, icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
