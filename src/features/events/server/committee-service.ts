import "server-only";

import type { Models } from "node-appwrite";
import { ID, Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { isAppwriteNotFound } from "@/server/errors";
import { getEventById, toEventCommittee } from "@/features/events/server/event-service";
import type {
  AssignEventRoleInput,
  Event,
  EventCommittee,
  EventRole,
} from "@/features/events/types";

type AppRow = Models.Row & Record<string, unknown>;

const ROLE_SORT_ORDER: Record<EventRole, number> = {
  chair: 0,
  committee_lead: 2,
  committee_member: 3,
  vice_chair: 1,
};

function sortCommittees(committees: EventCommittee[]): EventCommittee[] {
  return [...committees].sort((left, right) => {
    const roleDiff = ROLE_SORT_ORDER[left.role] - ROLE_SORT_ORDER[right.role];

    if (roleDiff !== 0) {
      return roleDiff;
    }

    return left.assigned_at.localeCompare(right.assigned_at);
  });
}

async function listActiveChairs(eventId: string): Promise<EventCommittee[]> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommittees,
    [
      Query.equal("event_id", eventId),
      Query.equal("role", "chair"),
      Query.equal("is_active", true),
      Query.limit(500),
    ],
    undefined,
    false,
  );

  return result.rows.map((row) => toEventCommittee(row as AppRow));
}

async function countActiveChairs(eventId: string) {
  const chairs = await listActiveChairs(eventId);
  return chairs.length;
}

export async function getUserEventRole(
  userId: string,
  eventId: string,
): Promise<EventCommittee | null> {
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

  return toEventCommittee(result.rows[0] as AppRow);
}

export async function updateCoChairDisplayRoles(eventId: string): Promise<void> {
  const chairs = await listActiveChairs(eventId);

  if (chairs.length === 0) {
    return;
  }

  const displayRole = chairs.length > 1 ? "Co-chair" : "Chair";
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  await Promise.all(
    chairs.map((chair) =>
      tables.updateRow(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.eventCommittees,
        chair.$id,
        { display_role: displayRole },
      ),
    ),
  );
}

export async function assignEventRole(
  input: AssignEventRoleInput,
  assignedByUserId: string,
): Promise<EventCommittee> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();
  const existing = await getUserEventRole(input.user_id, input.event_id);

  if (existing) {
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.eventCommittees,
      existing.$id,
      { is_active: false },
    );
  }

  let displayRole: string | undefined;

  if (input.role === "chair") {
    const chairCount = await countActiveChairs(input.event_id);
    displayRole = chairCount >= 1 ? "Co-chair" : "Chair";
  }

  const row = await tables.createRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommittees,
    ID.unique(),
    {
      assigned_at: now,
      assigned_by: assignedByUserId,
      committee_name: input.committee_name ?? "",
      display_role: displayRole ?? "",
      event_id: input.event_id,
      is_active: true,
      role: input.role,
      user_id: input.user_id,
    },
  );

  if (input.role === "chair") {
    await updateCoChairDisplayRoles(input.event_id);

    try {
      const updated = await tables.getRow(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.eventCommittees,
        row.$id,
      );

      return toEventCommittee(updated as AppRow);
    } catch (error) {
      if (isAppwriteNotFound(error)) {
        return toEventCommittee(row);
      }

      throw error;
    }
  }

  return toEventCommittee(row);
}

export async function removeEventRole(
  eventCommitteeId: string,
  removedByUserId: string,
): Promise<void> {
  void removedByUserId;

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const row = await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommittees,
    eventCommitteeId,
  );
  const committee = toEventCommittee(row as AppRow);

  await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommittees,
    eventCommitteeId,
    { is_active: false },
  );

  if (committee.role === "chair") {
    await updateCoChairDisplayRoles(committee.event_id);
  }
}

export async function getCommitteesForEvent(eventId: string): Promise<EventCommittee[]> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
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

  return sortCommittees(result.rows.map((row) => toEventCommittee(row as AppRow)));
}

export async function getCommitteeById(
  eventCommitteeId: string,
): Promise<EventCommittee | null> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  try {
    const row = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.eventCommittees,
      eventCommitteeId,
    );

    return toEventCommittee(row as AppRow);
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function getEventsForUser(
  userId: string,
): Promise<{ event: Event; role: EventCommittee }[]> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommittees,
    [
      Query.equal("user_id", userId),
      Query.equal("is_active", true),
      Query.limit(500),
    ],
    undefined,
    false,
  );

  const roles = result.rows.map((row) => toEventCommittee(row as AppRow));
  const events = await Promise.all(roles.map((role) => getEventById(role.event_id)));

  return roles.flatMap((role, index) => {
    const event = events[index];

    if (!event) {
      return [];
    }

    return [{ event, role }];
  });
}
