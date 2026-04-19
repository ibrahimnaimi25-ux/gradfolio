import Link from "next/link";

type KpiTileProps = {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  tone?: "default" | "indigo" | "emerald" | "amber" | "violet";
};

const TONE_CLASSES: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "text-slate-900",
  indigo: "text-indigo-700",
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  violet: "text-violet-700",
};

/**
 * Overview-style KPI card used on the company dashboard.
 * Optionally acts as a link to the detail page.
 */
export default function KpiTile({
  label,
  value,
  hint,
  href,
  tone = "default",
}: KpiTileProps) {
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${TONE_CLASSES[tone]}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </>
  );

  const base =
    "block rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition";

  if (href) {
    return (
      <Link href={href} className={`${base} hover:border-indigo-200 hover:shadow-md`}>
        {inner}
      </Link>
    );
  }

  return <div className={base}>{inner}</div>;
}
