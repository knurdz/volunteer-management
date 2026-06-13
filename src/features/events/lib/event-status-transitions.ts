import type { EventStatus } from "@/features/events/types";

/** Status transitions owned exclusively by the conclusion workflow API. */
export const CONCLUSION_MANAGED_STATUSES: EventStatus[] = [
  "pending_conclusion",
  "closed",
];

export class ConclusionManagedStatusError extends Error {
  constructor(status: EventStatus) {
    super(`Status "${status}" can only be set through the conclusion workflow endpoint.`);
    this.name = "ConclusionManagedStatusError";
  }
}

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

export function assertOperationalStatusTransition(
  current: EventStatus,
  next: EventStatus,
  options?: { allowAdminBackward?: boolean },
) {
  if (CONCLUSION_MANAGED_STATUSES.includes(next)) {
    throw new ConclusionManagedStatusError(next);
  }

  assertLegalEventStatusTransition(current, next, options);
}

export function getOperationalStatusTransitions(
  current: EventStatus,
  { isAdmin }: { isAdmin: boolean },
): EventStatus[] {
  const candidates: EventStatus[] = [
    "draft",
    "planning",
    "published",
    "ongoing",
    "pending_conclusion",
    "closed",
  ];

  return candidates.filter(
    (status) =>
      !CONCLUSION_MANAGED_STATUSES.includes(status) &&
      isLegalEventStatusTransition(current, status, { allowAdminBackward: isAdmin }),
  );
}
