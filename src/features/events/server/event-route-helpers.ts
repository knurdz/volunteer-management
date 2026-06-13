import "server-only";

import { canVolunteer, hasSbRole } from "@/features/access-control/lib/rules";
import type { SessionUser } from "@/features/access-control/types";
import {
  getEventPermissions,
  isEventVisibleToUser,
} from "@/features/events/lib/event-permissions";
import {
  assertOperationalStatusTransition,
  ConclusionManagedStatusError,
  isLegalEventStatusTransition,
} from "@/features/events/lib/event-status-transitions";
import { getUserEventRole } from "@/features/events/server/event-roles.server";
import { getEventById } from "@/features/events/server/event-service";
import type { Event, EventRole, EventStatus } from "@/features/events/types";
import { EVENT_STATUSES } from "@/features/events/types";
import { NextResponse } from "next/server";
import { jsonError, NotFoundError } from "@/server/errors";

export const VOLUNTEER_VISIBLE_STATUSES: EventStatus[] = [
  "published",
  "ongoing",
  "pending_conclusion",
];

export function canCreateEvent(user: SessionUser) {
  if (user.isAdmin) {
    return true;
  }

  return hasSbRole(user, ["ExCom", "SB Lead"]) && canVolunteer(user.profile);
}

export function parseValidationBody<T>(schema: import("zod").ZodType<T>, data: unknown) {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      error: NextResponse.json(
        { error: "Validation failed.", issues: result.error.issues },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}

export async function getEventUserContext(eventId: string, user: SessionUser) {
  const userEventRole = await getUserEventRole(user.authUser.id, eventId);

  return { userEventRole };
}

export function isEventVisible(
  user: SessionUser,
  event: Event,
  userEventRole?: EventRole | null,
) {
  return isEventVisibleToUser(
    user.authUser.id,
    user.isAdmin,
    event,
    userEventRole,
  );
}

export function getPermissionsForUser(
  user: SessionUser,
  event: Event,
  userEventRole?: EventRole | null,
) {
  return getEventPermissions(
    user.authUser.id,
    user.isAdmin,
    event,
    userEventRole,
  );
}

export async function requireVisibleEvent(eventId: string, user: SessionUser) {
  const event = await getEventById(eventId);

  if (!event) {
    throw new NotFoundError("Event was not found.");
  }

  const { userEventRole } = await getEventUserContext(eventId, user);

  if (!isEventVisible(user, event, userEventRole)) {
    throw new NotFoundError("Event was not found.");
  }

  return { event, userEventRole };
}

export function canChangeEventStatus({
  event,
  newStatus,
  user,
}: {
  event: Event;
  newStatus: EventStatus;
  user: SessionUser;
}) {
  if (!user.isAdmin) {
    return false;
  }

  try {
    assertOperationalStatusTransition(event.status, newStatus, {
      allowAdminBackward: true,
    });
    return true;
  } catch (error) {
    if (error instanceof ConclusionManagedStatusError) {
      return false;
    }

    return false;
  }
}

export function requireVerifiedVolunteer(user: SessionUser | null) {
  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  if (user.isAdmin) {
    return null;
  }

  if (!canVolunteer(user.profile)) {
    return jsonError("Verified UoM email is required before volunteering.", 403);
  }

  return null;
}

export function requireEventCreator(user: SessionUser | null) {
  const authError = requireVerifiedVolunteer(user);

  if (authError) {
    return authError;
  }

  if (!user || !canCreateEvent(user)) {
    return jsonError("Required Student Branch role is missing.", 403);
  }

  return null;
}

export function parseEventStatus(value: string | null): EventStatus | undefined {
  if (!value) {
    return undefined;
  }

  return EVENT_STATUSES.includes(value as EventStatus)
    ? (value as EventStatus)
    : undefined;
}

export function getAllowedStatusTransitions(
  current: EventStatus,
  { isAdmin }: { isAdmin: boolean },
) {
  return EVENT_STATUSES.filter(
    (status) =>
      isLegalEventStatusTransition(current, status, { allowAdminBackward: isAdmin }) &&
      (isAdmin
        ? (() => {
            try {
              assertOperationalStatusTransition(current, status, {
                allowAdminBackward: true,
              });
              return true;
            } catch {
              return false;
            }
          })()
        : false),
  );
}
