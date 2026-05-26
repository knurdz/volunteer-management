import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-surface text-text-primary shadow-card",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return <div className={cn("border-b border-border px-5 py-4", className)}>{children}</div>;
}

export function CardContent({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function CardTitle({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <h2 className={cn("text-base font-semibold text-text-primary", className)}>
      {children}
    </h2>
  );
}

export function CardDescription({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <p className={cn("mt-1 text-sm leading-6 text-text-secondary", className)}>
      {children}
    </p>
  );
}
