import "server-only";

import type { Models } from "node-appwrite";
import { ID, Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { assignEventRole as assignAccessControlEventRole } from "@/features/access-control/server/roles";
import { getActiveEventRoleAssignments } from "@/features/access-control/server/roles";
import { assertLegalEventStatusTransition } from "@/features/events/lib/event-status-transitions";
import { safeEventAuditLog } from "@/features/events/server/event-audit";
import { deleteCommittee, listCommitteesForEvent } from "@/features/events/server/committees.server";
import type {
  ConclusionStatus,
  CreateEventInput,
  Event,
  EventStatus,
  EventWithRoleAssignments,
  UpdateEventInput,
} from "@/features/events/types";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import {
  ConflictError,
  ForbiddenError,
  isAppwriteNotFound,
  NotFoundError,
} from "@/server/errors";

type AppRow = Models.Row & Record<string, unknown>;

const PUBLIC_STATUSES: EventStatus[] = ["published", "ongoing", "pending_conclusion"];
const RESTRICTED_STATUSES: EventStatus[] = ["draft", "planning"];

export function toEvent(row: AppRow): Event {
  return {
    $createdAt: row.$createdAt,
    $id: row.$id,
    $updatedAt: row.$updatedAt,
    conclusion_status: String(row.conclusion_status) as ConclusionStatus,
    created_at: String(row.created_at),
    created_by: String(row.created_by),
    description: typeof row.description === "string" ? row.description : undefined,
    end_date: typeof row.end_date === "string" ? row.end_date : undefined,
    reference: String(row.reference),
    start_date: String(row.start_date),
    status: String(row.status) as EventStatus,
    term: String(row.term),
    title: String(row.title),
    updated_at: String(row.updated_at),
    year: Number(row.year),
  };
}

export type GetEventsOptions = {
  limit?: number;
  offset?: number;
  status?: EventStatus;
  term?: string;
  userId?: string;
  isAdmin?: boolean;
};

export type GetEventsResult = {
  events: Event[];
  total: number;
  limit: number;
  offset: number;
};

async function getUserAssignedEventIds(userId: string) {
  const assignments = await getActiveEventRoleAssignments(userId);
  return new Set(assignments.map((assignment) => assignment.eventId));
}

function isEventVisibleToQuery({
  event,
  isAdmin,
  userAssignedEventIds,
  userId,
}: {
  event: Event;
  isAdmin: boolean;
  userAssignedEventIds: Set<string>;
  userId?: string;
}) {
  if (isAdmin) {
    return true;
  }

  if (PUBLIC_STATUSES.includes(event.status)) {
    return true;
  }

  if (!userId || !RESTRICTED_STATUSES.includes(event.status)) {
    return false;
  }

  return event.created_by === userId || userAssignedEventIds.has(event.$id);
}

export async function getEvents(options: GetEventsOptions = {}): Promise<GetEventsResult> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const queries = [Query.orderDesc("created_at"), Query.limit(500)];

  if (options.status) {
    queries.unshift(Query.equal("status", options.status));
  }

  if (options.term) {
    queries.unshift(Query.equal("term", options.term));
  }

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    queries,
    undefined,
    false,
  );

  const allEvents = result.rows.map((row) => toEvent(row as AppRow));
  const userAssignedEventIds = options.userId
    ? await getUserAssignedEventIds(options.userId)
    : new Set<string>();

  const visibleEvents = allEvents.filter((event) =>
    isEventVisibleToQuery({
      event,
      isAdmin: Boolean(options.isAdmin),
      userAssignedEventIds,
      userId: options.userId,
    }),
  );

  return {
    events: visibleEvents.slice(offset, offset + limit),
    limit,
    offset,
    total: visibleEvents.length,
  };
}

export async function listEvents(filters?: {
  status?: EventStatus;
  term?: string;
}): Promise<Event[]> {
  const result = await getEvents({
    isAdmin: true,
    limit: 500,
    offset: 0,
    status: filters?.status,
    term: filters?.term,
  });

  return result.events;
}

export async function assertEventVisibleToUser({
  event,
  isAdmin,
  userId,
}: {
  event: Event;
  isAdmin: boolean;
  userId: string;
}) {
  const userAssignedEventIds = await getUserAssignedEventIds(userId);

  if (
    !isEventVisibleToQuery({
      event,
      isAdmin,
      userAssignedEventIds,
      userId,
    })
  ) {
    throw new ForbiddenError("You do not have permission to view this event.");
  }
}

export async function createEvent(
  input: CreateEventInput,
  createdByUserId: string,
  { isAdmin = false }: { isAdmin?: boolean } = {},
): Promise<Event> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();

  const duplicate = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    [Query.equal("reference", input.reference), Query.limit(1)],
    undefined,
    false,
  );

  if (duplicate.rows.length > 0) {
    throw new ConflictError("An event with this reference already exists");
  }

  const row = await tables.createRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    ID.unique(),
    {
      conclusion_status: "not_submitted",
      created_at: now,
      created_by: createdByUserId,
      description: input.description ?? "",
      end_date: input.end_date ?? null,
      reference: input.reference,
      start_date: input.start_date,
      status: "draft",
      term: input.term,
      title: input.title,
      updated_at: now,
      year: input.year,
    },
  );

  const event = toEvent(row);

  await safeEventAuditLog({
    action: "event.create",
    actorUserId: createdByUserId,
    targetId: event.$id,
    targetType: "event",
  });

  if (!isAdmin) {
    try {
      await assignAccessControlEventRole({
        actorUserId: createdByUserId,
        eventId: event.$id,
        eventTitle: event.title,
        role: "Chair",
        userId: createdByUserId,
      });

      await safeEventAuditLog({
        action: "event_role.auto_assigned",
        actorUserId: createdByUserId,
        metadata: {
          reason: "event_creator",
          role: "Chair",
          user_id: createdByUserId,
        },
        targetId: event.$id,
        targetType: "event",
      });
    } catch (error) {
      await tables.deleteRow(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.events,
        event.$id,
      );

      throw error;
    }
  }

  return event;
}

export async function getEventById(eventId: string): Promise<Event | null> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  try {
    const row = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.events,
      eventId,
    );

    return toEvent(row as AppRow);
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

const CHAIR_EDITABLE_FIELDS = new Set([
  "title",
  "description",
  "start_date",
  "end_date",
  "term",
]);

export function filterUpdateInputForRole(
  input: UpdateEventInput,
  { isAdmin }: { isAdmin: boolean },
): UpdateEventInput {
  if (isAdmin) {
    return input;
  }

  const filtered: UpdateEventInput = {};

  for (const key of CHAIR_EDITABLE_FIELDS) {
    if (key in input && input[key as keyof UpdateEventInput] !== undefined) {
      (filtered as Record<string, unknown>)[key] = input[key as keyof UpdateEventInput];
    }
  }

  return filtered;
}

export async function updateEvent(
  eventId: string,
  input: UpdateEventInput,
  actorUserId: string,
): Promise<Event> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { updated_at: now };

  if (input.title !== undefined) {
    payload.title = input.title;
  }

  if (input.reference !== undefined) {
    payload.reference = input.reference;
  }

  if (input.description !== undefined) {
    payload.description = input.description ?? "";
  }

  if (input.term !== undefined) {
    payload.term = input.term;
  }

  if (input.year !== undefined) {
    payload.year = input.year;
  }

  if (input.start_date !== undefined) {
    payload.start_date = input.start_date;
  }

  if (input.end_date !== undefined) {
    payload.end_date = input.end_date ?? null;
  }

  if (input.status !== undefined) {
    payload.status = input.status;
  }

  if (input.conclusion_status !== undefined) {
    payload.conclusion_status = input.conclusion_status;
  }

  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    eventId,
    payload,
  );

  const event = toEvent(row);

  await safeEventAuditLog({
    action: "event.update",
    actorUserId,
    metadata: { changed_fields: Object.keys(input) },
    targetId: event.$id,
    targetType: "event",
  });

  return event;
}

export async function updateEventStatus(
  eventId: string,
  newStatus: EventStatus,
  options?: { allowAdminBackward?: boolean; actorUserId?: string },
): Promise<Event> {
  const event = await getEventById(eventId);

  if (!event) {
    throw new NotFoundError("Event was not found.");
  }

  const previousStatus = event.status;
  assertLegalEventStatusTransition(event.status, newStatus, options);

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();

  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    eventId,
    {
      status: newStatus,
      updated_at: now,
    },
  );

  const updated = toEvent(row);

  if (options?.actorUserId) {
    await safeEventAuditLog({
      action: "event.status_change",
      actorUserId: options.actorUserId,
      metadata: { from: previousStatus, to: newStatus },
      targetId: eventId,
      targetType: "event",
    });
  }

  return updated;
}

export async function submitConclusion(
  eventId: string,
  actorUserId: string,
): Promise<Event> {
  const event = await getEventById(eventId);

  if (!event) {
    throw new NotFoundError("Event was not found.");
  }

  if (event.status !== "ongoing") {
    throw new ConflictError("Conclusion can only be submitted from ongoing events.");
  }

  if (event.conclusion_status !== "not_submitted" && event.conclusion_status !== "rejected") {
    throw new ConflictError("Conclusion has already been submitted.");
  }

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();

  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    eventId,
    {
      conclusion_status: "submitted",
      status: "pending_conclusion",
      updated_at: now,
    },
  );

  const updated = toEvent(row);

  await safeEventAuditLog({
    action: "event.conclusion_submitted",
    actorUserId,
    targetId: eventId,
    targetType: "event",
  });

  return updated;
}

export async function approveConclusion(
  eventId: string,
  actorUserId: string,
): Promise<Event> {
  const event = await getEventById(eventId);

  if (!event) {
    throw new NotFoundError("Event was not found.");
  }

  if (event.conclusion_status !== "submitted") {
    throw new ConflictError("Conclusion must be submitted before approval.");
  }

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();

  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    eventId,
    {
      conclusion_status: "approved",
      status: "closed",
      updated_at: now,
    },
  );

  const updated = toEvent(row);

  await safeEventAuditLog({
    action: "event.conclusion_approved",
    actorUserId,
    targetId: eventId,
    targetType: "event",
  });

  return updated;
}

export async function rejectConclusion(
  eventId: string,
  actorUserId: string,
): Promise<Event> {
  const event = await getEventById(eventId);

  if (!event) {
    throw new NotFoundError("Event was not found.");
  }

  if (event.conclusion_status !== "submitted") {
    throw new ConflictError("Conclusion must be submitted before rejection.");
  }

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();

  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    eventId,
    {
      conclusion_status: "rejected",
      status: "ongoing",
      updated_at: now,
    },
  );

  const updated = toEvent(row);

  await safeEventAuditLog({
    action: "event.conclusion_rejected",
    actorUserId,
    targetId: eventId,
    targetType: "event",
  });

  return updated;
}

export async function deleteEvent(eventId: string, actorUserId: string): Promise<void> {
  const event = await getEventById(eventId);

  if (!event) {
    throw new NotFoundError("Event was not found.");
  }

  if (event.status !== "draft") {
    throw new ForbiddenError("Only draft events can be deleted.");
  }

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  const roleAssignments = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [Query.equal("eventId", eventId), Query.limit(500)],
    undefined,
    false,
  );

  await Promise.all(
    roleAssignments.rows.map((row) =>
      tables.deleteRow(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.eventRoleAssignments,
        row.$id,
      ),
    ),
  );

  const committees = await listCommitteesForEvent(eventId);

  for (const committee of committees) {
    const members = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.eventCommitteeMembers,
      [Query.equal("committee_id", committee.$id), Query.limit(500)],
      undefined,
      false,
    );

    await Promise.all(
      members.rows.map((member) =>
        tables.deleteRow(
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          APPWRITE_TABLES.eventCommitteeMembers,
          member.$id,
        ),
      ),
    );

    await deleteCommittee(committee.$id, actorUserId);
  }

  await tables.deleteRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    eventId,
  );

  await safeEventAuditLog({
    action: "event.delete",
    actorUserId,
    targetId: eventId,
    targetType: "event",
  });
}

export async function getEventWithRoleAssignments(
  eventId: string,
): Promise<EventWithRoleAssignments | null> {
  const event = await getEventById(eventId);

  if (!event) {
    return null;
  }

  const { getRoleAssignmentsForEvent } = await import(
    "@/features/events/server/event-roles.server"
  );
  const roleAssignments = await getRoleAssignmentsForEvent(eventId);

  return {
    ...event,
    roleAssignments,
  };
}
