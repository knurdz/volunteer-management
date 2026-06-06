import type { ConclusionStatus, EventStatus } from "@/features/events/types";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";
import { EVENT_STATUSES } from "@/features/events/types";
import { isLegalEventStatusTransition } from "@/features/events/lib/event-status-transitions";

export const eventInputClasses =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary";

export const eventTextareaClasses =
  "min-h-28 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary";

export function formatEventStatus(status: EventStatus) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatConclusionStatus(status: ConclusionStatus) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getEventStatusBadgeTone(status: EventStatus): BadgeTone {
  switch (status) {
    case "draft":
      return "neutral";
    case "planning":
      return "primary";
    case "published":
      return "primary";
    case "ongoing":
      return "success";
    case "pending_conclusion":
      return "warning";
    case "closed":
      return "neutral";
    default:
      return "neutral";
  }
}

export function getEventStatusBadgeClassName(status: EventStatus) {
  switch (status) {
    case "draft":
      return "border-border bg-surface-muted text-text-secondary";
    case "published":
      return "border-primary/30 bg-primary-soft text-primary";
    case "closed":
      return "border-border-strong bg-surface-subtle text-text-muted";
    default:
      return undefined;
  }
}

export function getConclusionStatusBadgeTone(status: ConclusionStatus): BadgeTone {
  switch (status) {
    case "not_submitted":
      return "neutral";
    case "submitted":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isoToDateInput(value?: string) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

export function dateInputToIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

export function getAvailableStatusTransitions(
  current: EventStatus,
  { isAdmin }: { isAdmin: boolean },
): EventStatus[] {
  return EVENT_STATUSES.filter((status) =>
    isLegalEventStatusTransition(current, status, { allowAdminBackward: isAdmin }),
  );
}

export function formatEventRole(role: string, displayRole?: string) {
  if (displayRole) {
    return displayRole;
  }

  return role;
}
