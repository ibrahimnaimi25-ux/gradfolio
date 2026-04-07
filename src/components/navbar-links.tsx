"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

export function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <>
      {links.map(({ href, label }) => {
        const isActive =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-indigo-50 text-indigo-700 font-semibold"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
