import type { EventStatus } from "@/features/events/types";

const LEGAL_FORWARD_TRANSITIONS: Record<EventStatus, EventStatus | null> = {
  closed: null,
  draft: "planning",
  ongoing: "pending_conclusion",
  pending_conclusion: "closed",
  planning: "published",
  published: "ongoing",
};

const ADMIN_BACKWARD_TRANSITIONS: Partial<Record<EventStatus, EventStatus>> = {
  planning: "draft",
  published: "planning",
};

export function isLegalEventStatusTransition(
  current: EventStatus,
  next: EventStatus,
  { allowAdminBackward = false }: { allowAdminBackward?: boolean } = {},
) {
  if (current === next) {
    return false;
  }

  if (LEGAL_FORWARD_TRANSITIONS[current] === next) {
    return true;
  }

  return allowAdminBackward && ADMIN_BACKWARD_TRANSITIONS[current] === next;
}

export function assertLegalEventStatusTransition(
  current: EventStatus,
  next: EventStatus,
  options?: { allowAdminBackward?: boolean },
) {
  if (!isLegalEventStatusTransition(current, next, options)) {
    throw new Error(`Illegal event status transition from "${current}" to "${next}".`);
  }
}
