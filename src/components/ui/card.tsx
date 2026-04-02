import { cn } from "@/lib/utils";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition hover:shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

type CardTitleProps = {
  children: React.ReactNode;
  className?: string;
};

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn("text-lg font-semibold tracking-tight", className)}>
      {children}
    </h3>
  );
}

type CardDescriptionProps = {
  children: React.ReactNode;
  className?: string;
};

export function CardDescription({
  children,
  className,
}: CardDescriptionProps) {
  return <p className={cn("text-sm text-gray-600", className)}>{children}</p>;
}

type CardContentProps = {
  children: React.ReactNode;
  className?: string;
};

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("", className)}>{children}</div>;
}