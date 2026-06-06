import "server-only";

import type { Models } from "node-appwrite";
import { ID, Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { isAppwriteNotFound } from "@/server/errors";
import { assertLegalEventStatusTransition } from "@/features/events/lib/event-status-transitions";
import type {
  ConclusionStatus,
  CreateEventInput,
  Event,
  EventCommittee,
  EventRole,
  EventStatus,
  EventWithCommittees,
  UpdateEventInput,
} from "@/features/events/types";

type AppRow = Models.Row & Record<string, unknown>;

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

export function toEventCommittee(row: AppRow): EventCommittee {
  return {
    $createdAt: row.$createdAt,
    $id: row.$id,
    $updatedAt: row.$updatedAt,
    assigned_at: String(row.assigned_at),
    assigned_by: String(row.assigned_by),
    committee_name:
      typeof row.committee_name === "string" ? row.committee_name : undefined,
    display_role: typeof row.display_role === "string" ? row.display_role : undefined,
    event_id: String(row.event_id),
    is_active: Boolean(row.is_active),
    role: String(row.role) as EventRole,
    user_id: String(row.user_id),
  };
}

export async function createEvent(
  input: CreateEventInput,
  createdByUserId: string,
): Promise<Event> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();

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

  return toEvent(row);
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

export async function listEvents(filters?: {
  status?: EventStatus;
  term?: string;
}): Promise<Event[]> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const queries = [Query.orderDesc("created_at"), Query.limit(500)];

  if (filters?.status) {
    queries.unshift(Query.equal("status", filters.status));
  }

  if (filters?.term) {
    queries.unshift(Query.equal("term", filters.term));
  }

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    queries,
    undefined,
    false,
  );

  return result.rows.map((row) => toEvent(row as AppRow));
}

export async function updateEvent(
  eventId: string,
  input: UpdateEventInput,
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

  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    eventId,
    payload,
  );

  return toEvent(row);
}

export async function updateEventStatus(
  eventId: string,
  newStatus: EventStatus,
  options?: { allowAdminBackward?: boolean },
): Promise<Event> {
  const event = await getEventById(eventId);

  if (!event) {
    throw new Error("Event was not found.");
  }

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

  return toEvent(row);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  const committeeResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommittees,
    [Query.equal("event_id", eventId), Query.limit(500)],
    undefined,
    false,
  );

  await Promise.all(
    committeeResult.rows.map((row) =>
      tables.deleteRow(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.eventCommittees,
        row.$id,
      ),
    ),
  );

  await tables.deleteRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.events,
    eventId,
  );
}

export async function getUserCommitteeRole(
  eventId: string,
  userId: string,
): Promise<EventRole | null> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommittees,
    [
      Query.equal("event_id", eventId),
      Query.equal("user_id", userId),
      Query.equal("is_active", true),
      Query.limit(1),
    ],
    undefined,
    false,
  );

  if (result.rows.length === 0) {
    return null;
  }

  return toEventCommittee(result.rows[0] as AppRow).role;
}

export async function getEventWithCommittees(
  eventId: string,
): Promise<EventWithCommittees | null> {
  const event = await getEventById(eventId);

  if (!event) {
    return null;
  }

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  const committeeResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommittees,
    [
      Query.equal("event_id", eventId),
      Query.equal("is_active", true),
      Query.limit(500),
    ],
    undefined,
    false,
  );

  return {
    ...event,
    committees: committeeResult.rows.map((row) => toEventCommittee(row as AppRow)),
  };
}
