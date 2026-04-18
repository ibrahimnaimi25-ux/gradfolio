import Link from "next/link";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  /** Builds the href for a given page number. */
  buildHref: (page: number) => string;
  /** Label for the items — e.g. "students", "submissions". */
  itemLabel?: string;
};

/**
 * Compact pagination: "Prev · 1 … 4 5 [6] 7 8 … 20 · Next".
 * Pure server component — receives a `buildHref` closure from the parent page.
 */
export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  buildHref,
  itemLabel = "items",
}: PaginationProps) {
  if (totalPages <= 1) {
    return (
      <p className="px-1 text-xs text-slate-400">
        {totalItems} {itemLabel}
      </p>
    );
  }

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  // Build compact page number list with ellipses
  const pages: (number | "…")[] = [];
  const add = (n: number) => {
    if (pages[pages.length - 1] !== n) pages.push(n);
  };

  const windowSize = 1; // pages on each side of current
  add(1);
  if (currentPage - windowSize > 2) pages.push("…");
  for (
    let p = Math.max(2, currentPage - windowSize);
    p <= Math.min(totalPages - 1, currentPage + windowSize);
    p++
  ) {
    add(p);
  }
  if (currentPage + windowSize < totalPages - 1) pages.push("…");
  if (totalPages > 1) add(totalPages);

  const btnBase =
    "inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border px-3 text-sm font-medium transition";
  const btnIdle =
    "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  const btnActive =
    "border-slate-900 bg-slate-900 text-white";
  const btnDisabled =
    "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <p className="text-xs text-slate-500">
        Showing{" "}
        <strong className="text-slate-700">
          {from}–{to}
        </strong>{" "}
        of <strong className="text-slate-700">{totalItems}</strong> {itemLabel}
      </p>

      <nav className="flex flex-wrap items-center gap-1.5" aria-label="Pagination">
        {currentPage > 1 ? (
          <Link
            href={buildHref(currentPage - 1)}
            className={`${btnBase} ${btnIdle}`}
            aria-label="Previous page"
          >
            ← Prev
          </Link>
        ) : (
          <span className={`${btnBase} ${btnDisabled}`} aria-hidden="true">
            ← Prev
          </span>
        )}

        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`ellipsis-${i}`}
              className="inline-flex h-9 w-6 items-center justify-center text-sm text-slate-400"
              aria-hidden="true"
            >
              …
            </span>
          ) : p === currentPage ? (
            <span
              key={p}
              className={`${btnBase} ${btnActive}`}
              aria-current="page"
            >
              {p}
            </span>
          ) : (
            <Link
              key={p}
              href={buildHref(p)}
              className={`${btnBase} ${btnIdle}`}
              aria-label={`Go to page ${p}`}
            >
              {p}
            </Link>
          )
        )}

        {currentPage < totalPages ? (
          <Link
            href={buildHref(currentPage + 1)}
            className={`${btnBase} ${btnIdle}`}
            aria-label="Next page"
          >
            Next →
          </Link>
        ) : (
          <span className={`${btnBase} ${btnDisabled}`} aria-hidden="true">
            Next →
          </span>
        )}
      </nav>
    </div>
  );
}
