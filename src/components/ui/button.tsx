import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

type BaseProps = {
  children: React.ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

type ButtonAsButtonProps = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type ButtonAsLinkProps = BaseProps & {
  href: string;
};

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

function getButtonClasses(variant: ButtonVariant = "primary") {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition focus:outline-none";

  const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
  ghost: "bg-transparent text-gray-900 hover:bg-gray-100",
};
  return cn(base, variants[variant]);
}

export function Button(props: ButtonProps) {
  const { children, className, variant = "primary" } = props;

  if ("href" in props) {
    return (
      <Link href={props.href} className={cn(getButtonClasses(variant), className)}>
        {children}
      </Link>
    );
  }

  return (
    <button {...props} className={cn(getButtonClasses(variant), className)}>
      {children}
    </button>
  );
}