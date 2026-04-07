import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";
import { UrlObject } from "url";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type BaseProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

type ButtonAsButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonAsLinkProps = BaseProps & {
  href: string | UrlObject;
};

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

function getButtonClasses(variant: ButtonVariant = "primary") {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:pointer-events-none disabled:opacity-50";

  const variants: Record<ButtonVariant, string> = {
    primary: "bg-slate-900 !text-white hover:bg-slate-700",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    outline: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
    ghost: "text-slate-800 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  return cn(base, variants[variant]);
}

export function Button(props: ButtonProps) {
  const { children, className, variant = "primary" } = props;

  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        className={cn(getButtonClasses(variant), className)}
      >
        {children}
      </Link>
    );
  }

  const { href: _href, ...buttonProps } = props as ButtonAsButtonProps;

  return (
    <button
      {...buttonProps}
      className={cn(getButtonClasses(variant), className)}
    >
      {children}
    </button>
  );
}