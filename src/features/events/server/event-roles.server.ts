import "server-only";

import type { Models } from "node-appwrite";
import { Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import {
  getEventRoleDisplayName,
  normalizeCommitteeName,
  requiresCommitteeName,
} from "@/features/access-control/lib/rules";
import {
  assignEventRole as assignAccessControlEventRole,
  getActiveEventRoleAssignments,
  revokeEventRole,
  toEventRoleAssignment,
} from "@/features/access-control/server/roles";
import type { EventRole, EventRoleAssignment } from "@/features/access-control/types";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { ValidationError } from "@/server/errors";
import { safeEventAuditLog } from "@/features/events/server/event-audit";
import { hasCommitteesForEvent } from "@/features/events/server/committees.server";
import { validateAssignableEventUser } from "@/features/events/server/event-user-validation";
import { getEventById } from "@/features/events/server/event-service";
import type { AssignEventRoleInput } from "@/features/events/types";

type AppRow = Models.Row & Record<string, unknown>;

export async function getRoleAssignmentsForEvent(
  eventId: string,
): Promise<EventRoleAssignment[]> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [
      Query.equal("eventId", eventId),
      Query.equal("active", true),
      Query.orderDesc("assignedAt"),
      Query.limit(500),
    ],
    undefined,
    false,
  );

  const assignments = result.rows.map((row) => toEventRoleAssignment(row as AppRow));
  const chairCount = assignments.filter((assignment) => assignment.role === "Chair").length;

  return assignments.map((assignment) => ({
    ...assignment,
    eventChairCount: chairCount,
  }));
}

export async function getUserEventRoleAssignment(
  userId: string,
  eventId: string,
): Promise<EventRoleAssignment | null> {
  const assignments = await getActiveEventRoleAssignments(userId);
  return assignments.find((assignment) => assignment.eventId === eventId) ?? null;
}

export async function getUserEventRole(
  userId: string,
  eventId: string,
): Promise<EventRole | null> {
  const assignment = await getUserEventRoleAssignment(userId, eventId);
  return assignment?.role ?? null;
}

export async function assignEventRole(
  input: AssignEventRoleInput,
  assignedByUserId: string,
): Promise<EventRoleAssignment> {
  await validateAssignableEventUser(input.user_id);

  const event = await getEventById(input.event_id);

  if (!event) {
    throw new ValidationError("Event was not found.");
  }

  if (requiresCommitteeName(input.role)) {
    const committeeName = normalizeCommitteeName(input.committee_name);

    if (!committeeName) {
      throw new ValidationError(`${input.role} assignments require a committee name.`);
    }

    const hasCommittees = await hasCommitteesForEvent(input.event_id);

    if (!hasCommittees) {
      throw new ValidationError(
        "Cannot assign Committee Lead or Committee Member when no committees exist for this event.",
      );
    }
  }

  const assignment = await assignAccessControlEventRole({
    actorUserId: assignedByUserId,
    committeeName: input.committee_name,
    eventId: input.event_id,
    eventTitle: event.title,
    role: input.role,
    userId: input.user_id,
  });

  await safeEventAuditLog({
    action: "event_role.assign",
    actorUserId: assignedByUserId,
    metadata: { role: input.role, user_id: input.user_id },
    targetId: input.event_id,
    targetType: "event",
  });

  return assignment;
}

export async function updateEventRole({
  actorUserId,
  committeeName,
  eventId,
  eventTitle,
  newRole,
  oldAssignmentId,
  userId,
}: {
  actorUserId: string;
  committeeName?: string;
  eventId: string;
  eventTitle: string;
  newRole: EventRole;
  oldAssignmentId: string;
  userId: string;
}): Promise<EventRoleAssignment> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  const oldRow = await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    oldAssignmentId,
  );
  const oldAssignment = toEventRoleAssignment(oldRow as AppRow);

  const newAssignment = await assignAccessControlEventRole({
    actorUserId,
    committeeName,
    eventId,
    eventTitle,
    role: newRole,
    userId,
  });

  try {
    await tables.deleteRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.eventRoleAssignments,
      oldAssignmentId,
    );
  } catch (error) {
    console.error("Failed to delete old role assignment after creating new one:", error);
    await safeEventAuditLog({
      action: "event_role.orphan_cleanup_needed",
      actorUserId,
      metadata: { new_id: newAssignment.$id, old_id: oldAssignmentId },
      targetId: eventId,
      targetType: "event",
    });
  }

  await safeEventAuditLog({
    action: "event_role.update",
    actorUserId,
    metadata: {
      new_role: newRole,
      old_role: oldAssignment.role,
      user_id: userId,
    },
    targetId: eventId,
    targetType: "event",
  });

  return newAssignment;
}

export async function removeEventRole(
  assignmentId: string,
  removedByUserId: string,
): Promise<void> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const row = await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    assignmentId,
  );
  const assignment = toEventRoleAssignment(row as AppRow);

  await revokeEventRole({
    actorUserId: removedByUserId,
    assignmentId,
  });

  await safeEventAuditLog({
    action: "event_role.remove",
    actorUserId: removedByUserId,
    metadata: { removed_role: assignment.role, user_id: assignment.userId },
    targetId: assignment.eventId,
    targetType: "event",
  });
}

export async function getEventsForUser(
  userId: string,
): Promise<{ event: NonNullable<Awaited<ReturnType<typeof getEventById>>>; role: EventRoleAssignment }[]> {
  const assignments = await getActiveEventRoleAssignments(userId);
  const createdEvents = await listEventsCreatedByUser(userId);
  const eventIds = new Set<string>();

  const fromRoles = await Promise.all(
    assignments.map(async (assignment) => {
      const event = await getEventById(assignment.eventId);

      if (!event || eventIds.has(event.$id)) {
        return null;
      }

      eventIds.add(event.$id);
      return { event, role: assignment };
    }),
  );

  const fromCreated = await Promise.all(
    createdEvents
      .filter((event) => !eventIds.has(event.$id))
      .map(async (event) => {
        const role =
          (await getUserEventRoleAssignment(userId, event.$id)) ??
          ({
            $id: "",
            active: true,
            assignedAt: event.created_at,
            assignedBy: event.created_by,
            eventId: event.$id,
            eventTitle: event.title,
            role: "Chair" as EventRole,
            userId,
          } satisfies EventRoleAssignment);

        return { event, role };
      }),
  );

  return [...fromRoles, ...fromCreated].filter(
    (entry): entry is { event: NonNullable<Awaited<ReturnType<typeof getEventById>>>; role: EventRoleAssignment } =>
      entry !== null,
  );
}

async function listEventsCreatedByUser(userId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    [Query.equal("created_by", userId), Query.limit(500)],
    undefined,
    false,
  );

  const { toEvent } = await import("@/features/events/server/event-service");
  return result.rows.map((row) => toEvent(row as AppRow));
}

export function formatRoleAssignmentDisplay(assignment: EventRoleAssignment) {
  return getEventRoleDisplayName(assignment.role, {
    chairCount: assignment.eventChairCount ?? 0,
  });
}
