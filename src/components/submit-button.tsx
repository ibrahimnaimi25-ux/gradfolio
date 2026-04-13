"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  loadingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
};

/**
 * Drop-in replacement for any <button type="submit"> inside a server action form.
 * Automatically shows a spinner and disables itself while the action is running.
 * Must be rendered as a direct child (or descendant) of a <form>.
 */
export default function SubmitButton({
  label,
  loadingLabel,
  className,
  variant = "primary",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-700",
    secondary:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${base} ${variants[variant]} ${className ?? ""}`}
    >
      {pending && (
        <svg
          className="h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {pending ? (loadingLabel ?? "Saving…") : label}
    </button>
  );
}
