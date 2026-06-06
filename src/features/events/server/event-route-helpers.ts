import "server-only";

import { z } from "zod";
import { canVolunteer, hasSbRole } from "@/features/access-control/lib/rules";
import type { SessionUser } from "@/features/access-control/types";
import {
  getEventPermissions,
  isEventVisibleToUser,
} from "@/features/events/lib/event-permissions";
import { getUserCommitteeRole } from "@/features/events/server/event-service";
import type { Event, EventRole, EventStatus } from "@/features/events/types";
import { EVENT_STATUSES } from "@/features/events/types";
import { NextResponse } from "next/server";
import { jsonError } from "@/server/errors";

export const VOLUNTEER_VISIBLE_STATUSES: EventStatus[] = ["published", "ongoing", "closed"];

export function resolveUserSbRole(user: SessionUser) {
  return user.isAdmin ? "Admin" : "";
}

export function canCreateEvent(user: SessionUser) {
  return user.isAdmin || hasSbRole(user, ["ExCom", "SB Lead"]);
}

export function parseValidationBody<T>(schema: z.ZodType<T>, data: unknown) {
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
  const userSbRole = resolveUserSbRole(user);
  const userCommitteeRole = await getUserCommitteeRole(eventId, user.authUser.id);

  return { userCommitteeRole, userSbRole };
}

export function isEventVisible(
  user: SessionUser,
  event: Event,
  userCommitteeRole?: EventRole | null,
) {
  return isEventVisibleToUser(
    user.authUser.id,
    resolveUserSbRole(user),
    event,
    userCommitteeRole,
  );
}

export function getPermissionsForUser(
  user: SessionUser,
  event: Event,
  userCommitteeRole?: EventRole | null,
) {
  return getEventPermissions(
    user.authUser.id,
    resolveUserSbRole(user),
    event,
    userCommitteeRole,
  );
}

export function canChangeEventStatus({
  event,
  newStatus,
  user,
  userCommitteeRole,
}: {
  event: Event;
  newStatus: EventStatus;
  user: SessionUser;
  userCommitteeRole?: EventRole | null;
}) {
  if (user.isAdmin) {
    return true;
  }

  return (
    userCommitteeRole === "chair" &&
    event.status === "ongoing" &&
    newStatus === "pending_conclusion"
  );
}

export function requireVerifiedVolunteer(user: SessionUser | null) {
  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  if (!canVolunteer(user.profile)) {
    return jsonError("Verified UoM email is required before volunteering.", 403);
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
