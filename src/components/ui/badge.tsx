import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  neutral:
    "border-border bg-surface-muted text-text-secondary",
  primary:
    "border-primary/25 bg-primary-soft text-primary",
  success:
    "border-success/25 bg-success-soft text-success",
  warning:
    "border-warning/25 bg-warning-soft text-warning",
  danger:
    "border-danger/25 bg-danger-soft text-danger",
};

export function Badge({
  children,
  className,
  tone = "neutral",
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  tone?: BadgeTone;
}>) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
