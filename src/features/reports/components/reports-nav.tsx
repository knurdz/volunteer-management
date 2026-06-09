"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  ClipboardList,
  FileBarChart,
  FileText,
  LayoutGrid,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const overviewItem = {
  href: "/reports",
  icon: LayoutGrid,
  label: "Overview",
} as const;

const recognitionItem = {
  href: "/reports/recognition",
  icon: Award,
  label: "Recognition",
} as const;

const volunteersItem = {
  href: "/reports/volunteers",
  icon: UsersRound,
  label: "Volunteer PDFs",
} as const;

const conclusionsItem = {
  href: "/reports/conclusions",
  icon: ClipboardList,
  label: "Conclusions",
} as const;

const adminApprovalItem = {
  href: "/reports/approval",
  icon: FileText,
  label: "Admin approval",
} as const;

type ReportsNavProps = {
  canAccessConclusions: boolean;
  isAdmin: boolean;
};

export function ReportsNav({ canAccessConclusions, isAdmin }: ReportsNavProps) {
  const pathname = usePathname();

  const items = isAdmin
    ? [overviewItem, recognitionItem, volunteersItem, conclusionsItem, adminApprovalItem]
    : canAccessConclusions
      ? [recognitionItem, conclusionsItem]
      : [recognitionItem];

  return (
    <nav
      aria-label="Reports navigation"
      className="inline-flex flex-wrap gap-2 rounded-md border border-border bg-surface p-1"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/reports"
            ? pathname === "/reports"
            : pathname.startsWith(item.href);

        return (
          <Link
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
              isActive
                ? "border-primary/30 bg-primary-soft text-primary"
                : "border-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary",
            )}
            href={item.href}
            key={item.href}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ReportsPageIcon() {
  return <FileBarChart className="size-4 text-primary" aria-hidden="true" />;
}
