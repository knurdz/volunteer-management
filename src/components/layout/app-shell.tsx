import Link from "next/link";
import { Flag, LayoutDashboard, LogOut, MailCheck, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/features/access-control/types";

export function AppShell({
  active,
  children,
  user,
}: Readonly<{
  active: "dashboard" | "moderation" | "verification" | "users" | "volunteers";
  children: React.ReactNode;
  user: SessionUser;
}>) {
  const navItems = [
    {
      href: "/dashboard",
      icon: LayoutDashboard,
      id: "dashboard",
      label: "Overview",
    },
    {
      href: "/verify-uom",
      icon: MailCheck,
      id: "verification",
      label: "UoM Verification",
    },
    {
      href: "/volunteers/me",
      icon: UserRound,
      id: "volunteers",
      label: "Volunteer Profile",
    },
    ...(user.isAdmin
      ? [
          {
            href: "/admin/users",
            icon: UsersRound,
            id: "users",
            label: "Access Control",
          },
          {
            href: "/admin/recommendations",
            icon: Flag,
            id: "moderation",
            label: "Moderation",
          },
        ]
      : []),
  ] as const;

  return (
    <main className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">
                {ORGANIZATION_NAME}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md border border-primary/20 bg-primary-soft text-primary">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </span>
                <h1 className="text-xl font-semibold text-text-primary">
                  {APP_NAME}
                </h1>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium text-text-primary">
                  {user.authUser.name || user.authUser.email}
                </p>
                <p className="truncate text-text-secondary">{user.authUser.email}</p>
              </div>
              <form action="/api/auth/logout" method="post">
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
                  type="submit"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === active;

              return (
                <Link
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary-soft text-primary"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-muted hover:text-text-primary",
                  )}
                  href={item.href}
                  key={item.id}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        {children}
      </div>
    </main>
  );
}
