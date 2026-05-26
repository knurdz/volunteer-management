import { cn } from "@/lib/utils";

export function PageHeader({
  actions,
  eyebrow,
  title,
  description,
  className,
}: Readonly<{
  actions?: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}>) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-sm font-semibold uppercase text-primary">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
