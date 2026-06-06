import "server-only";

import type { Models } from "node-appwrite";
import { ID, Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { ConflictError, isAppwriteConflict, isAppwriteNotFound } from "@/server/errors";
import { safeEventAuditLog } from "@/features/events/server/event-audit";
import { validateAssignableEventUser } from "@/features/events/server/event-user-validation";
import type { Committee, CommitteeMember, CreateCommitteeInput } from "@/features/events/types";

type AppRow = Models.Row & Record<string, unknown>;

export function toCommittee(row: AppRow): Committee {
  return {
    $createdAt: row.$createdAt,
    $id: row.$id,
    $updatedAt: row.$updatedAt,
    created_at: String(row.created_at),
    description: typeof row.description === "string" ? row.description : undefined,
    event_id: String(row.event_id),
    name: String(row.name),
    updated_at: String(row.updated_at),
  };
}

export function toCommitteeMember(row: AppRow): CommitteeMember {
  return {
    $createdAt: row.$createdAt,
    $id: row.$id,
    $updatedAt: row.$updatedAt,
    added_at: String(row.added_at),
    added_by: String(row.added_by),
    committee_id: String(row.committee_id),
    user_id: String(row.user_id),
  };
}

export async function listCommitteesForEvent(eventId: string): Promise<Committee[]> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommittees,
    [Query.equal("event_id", eventId), Query.orderAsc("name"), Query.limit(500)],
    undefined,
    false,
  );

  return result.rows.map((row) => toCommittee(row as AppRow));
}

export async function getCommitteeById(committeeId: string): Promise<Committee | null> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  try {
    const row = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.eventCommittees,
      committeeId,
    );

    return toCommittee(row as AppRow);
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function createCommittee(
  input: CreateCommitteeInput,
  actorUserId: string,
): Promise<Committee> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();

  const row = await tables.createRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommittees,
    ID.unique(),
    {
      created_at: now,
      description: input.description ?? "",
      event_id: input.event_id,
      name: input.name,
      updated_at: now,
    },
  );

  const committee = toCommittee(row);

  await safeEventAuditLog({
    action: "committee.create",
    actorUserId,
    targetId: committee.$id,
    targetType: "committee",
  });

  return committee;
}

export async function deleteCommittee(
  committeeId: string,
  actorUserId: string,
): Promise<void> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  const members = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommitteeMembers,
    [Query.equal("committee_id", committeeId), Query.limit(500)],
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

  await tables.deleteRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommittees,
    committeeId,
  );

  await safeEventAuditLog({
    action: "committee.delete",
    actorUserId,
    targetId: committeeId,
    targetType: "committee",
  });
}

export async function listCommitteeMembers(committeeId: string): Promise<CommitteeMember[]> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommitteeMembers,
    [Query.equal("committee_id", committeeId), Query.limit(500)],
    undefined,
    false,
  );

  return result.rows.map((row) => toCommitteeMember(row as AppRow));
}

export async function addCommitteeMember({
  actorUserId,
  committeeId,
  userId,
}: {
  actorUserId: string;
  committeeId: string;
  userId: string;
}): Promise<CommitteeMember> {
  await validateAssignableEventUser(userId);

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  const existing = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommitteeMembers,
    [
      Query.equal("committee_id", committeeId),
      Query.equal("user_id", userId),
      Query.limit(1),
    ],
    undefined,
    false,
  );

  if (existing.rows.length > 0) {
    throw new ConflictError("User is already a member of this committee");
  }

  const now = new Date().toISOString();

  try {
    const row = await tables.createRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.eventCommitteeMembers,
      ID.unique(),
      {
        added_at: now,
        added_by: actorUserId,
        committee_id: committeeId,
        user_id: userId,
      },
    );

    const member = toCommitteeMember(row);

    await safeEventAuditLog({
      action: "committee.member_add",
      actorUserId,
      metadata: { user_id: userId },
      targetId: committeeId,
      targetType: "committee",
    });

    return member;
  } catch (error) {
    if (isAppwriteConflict(error)) {
      throw new ConflictError("User is already a member of this committee");
    }

    throw error;
  }
}

export async function removeCommitteeMember({
  actorUserId,
  committeeId,
  memberId,
  userId,
}: {
  actorUserId: string;
  committeeId: string;
  memberId: string;
  userId: string;
}): Promise<void> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  await tables.deleteRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventCommitteeMembers,
    memberId,
  );

  await safeEventAuditLog({
    action: "committee.member_remove",
    actorUserId,
    metadata: { user_id: userId },
    targetId: committeeId,
    targetType: "committee",
  });
}

export async function hasCommitteesForEvent(eventId: string) {
  const committees = await listCommitteesForEvent(eventId);
  return committees.length > 0;
}
