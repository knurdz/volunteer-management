import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";

export function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-background text-text-primary">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 py-5 sm:px-8 lg:px-10">
          <p className="text-sm font-medium text-text-secondary">
            {ORGANIZATION_NAME}
          </p>
          <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">
            {APP_NAME}
          </h1>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        {children}
      </div>
    </main>
  );
}
