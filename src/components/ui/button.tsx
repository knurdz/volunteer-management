import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-white hover:bg-primary-hover",
  secondary:
    "border-border-strong bg-surface text-text-primary hover:bg-surface-muted",
  ghost:
    "border-transparent bg-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary",
};

export function Button({
  children,
  className,
  variant = "secondary",
  ...props
}: Readonly<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
  }
>) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
