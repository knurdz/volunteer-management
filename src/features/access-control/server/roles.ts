import "server-only";

import { createHash } from "node:crypto";
import type { Models } from "node-appwrite";
import { Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import {
  isEventRole,
  isSbRole,
  normalizeCommitteeName,
  normalizeEventReference,
  normalizeEventRole,
  requiresCommitteeName,
} from "@/features/access-control/lib/rules";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { isAppwriteNotFound } from "@/server/errors";
import { getProfile } from "@/features/access-control/server/profiles";
import type { EventRole, EventRoleAssignment, RoleAssignment, SbRole } from "@/features/access-control/types";

type AppRow = Models.Row & Record<string, unknown>;

function roleRowId(userId: string, role: SbRole) {
  return `${userId}_${role.toLowerCase().replaceAll(" ", "_")}`;
}

function eventRoleRowId({
  committeeName,
  eventId,
  role,
  userId,
}: {
  committeeName?: string;
  eventId: string;
  role: EventRole;
  userId: string;
}) {
  const seed = [
    normalizeEventReference(eventId).toLowerCase(),
    userId,
    role.toLowerCase(),
    normalizeCommitteeName(committeeName)?.toLowerCase() ?? "",
  ].join(":");

  return `er_${createHash("sha1").update(seed).digest("hex").slice(0, 30)}`;
}

async function requireRoleAssignableProfile(userId: string) {
  const profile = await getProfile(userId);

  if (!profile) {
    throw new Error("Target profile was not found.");
  }

  if (profile.status !== "ACTIVE") {
    throw new Error("Roles can only be assigned to active profiles.");
  }

  if (!profile.uomVerified) {
    throw new Error("UoM verification is required before assigning roles.");
  }

  return profile;
}

async function findExistingEventRoleRow({
  active,
  committeeName,
  eventId,
  role,
  userId,
}: {
  active: boolean;
  committeeName?: string;
  eventId: string;
  role: EventRole;
  userId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [
      Query.equal("userId", userId),
      Query.equal("eventId", eventId),
      Query.equal("role", role),
      Query.equal("committeeName", committeeName ?? ""),
      Query.equal("active", active),
      Query.limit(1),
    ],
    undefined,
    false,
  );

  return result.rows[0] as AppRow | undefined;
}

export function toRoleAssignment(row: AppRow): RoleAssignment {
  return {
    $id: row.$id,
    active: Boolean(row.active),
    assignedAt: String(row.assignedAt),
    assignedBy: String(row.assignedBy),
    revokedAt:
      typeof row.revokedAt === "string" && row.revokedAt ? row.revokedAt : undefined,
    role: String(row.role) as SbRole,
    userId: String(row.userId),
  };
}

export function toEventRoleAssignment(row: AppRow): EventRoleAssignment {
  const role = normalizeEventRole(String(row.role));

  if (!role) {
    throw new Error(`Invalid event role stored for assignment ${row.$id}.`);
  }

  return {
    $id: row.$id,
    active: Boolean(row.active),
    assignedAt: String(row.assignedAt),
    assignedBy: String(row.assignedBy),
    committeeName:
      typeof row.committeeName === "string" && row.committeeName
        ? row.committeeName
        : undefined,
    eventId: String(row.eventId),
    eventTitle: String(row.eventTitle),
    revokedAt:
      typeof row.revokedAt === "string" && row.revokedAt ? row.revokedAt : undefined,
    role,
    userId: String(row.userId),
  };
}

export function parseSbRole(role: string) {
  if (!isSbRole(role)) {
    throw new Error("Invalid Student Branch role.");
  }

  return role;
}

export function parseEventRole(role: string) {
  const normalizedRole = normalizeEventRole(role);

  if (!isEventRole(role) || !normalizedRole) {
    throw new Error("Invalid event role.");
  }

  return normalizedRole;
}

export async function getActiveSbRoles(userId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.sbRoleAssignments,
    [Query.equal("userId", userId), Query.equal("active", true), Query.limit(25)],
    undefined,
    false,
  );

  return result.rows.map((row) => String((row as AppRow).role) as SbRole);
}

export async function getActiveEventRoleAssignments(userId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [Query.equal("userId", userId), Query.equal("active", true), Query.limit(500)],
    undefined,
    false,
  );

  const assignments = result.rows.map((row) => toEventRoleAssignment(row as AppRow));

  if (assignments.length === 0) {
    return assignments;
  }

  const eventIds = [...new Set(assignments.map((assignment) => assignment.eventId))];
  const chairResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [
      Query.equal("eventId", eventIds),
      Query.equal("role", "Chair"),
      Query.equal("active", true),
      Query.limit(500),
    ],
    undefined,
    false,
  );
  const chairCounts = new Map<string, number>();

  for (const row of chairResult.rows) {
    const eventKey = normalizeEventReference(String((row as AppRow).eventId)).toLowerCase();
    chairCounts.set(eventKey, (chairCounts.get(eventKey) ?? 0) + 1);
  }

  return assignments.map((assignment) => ({
    ...assignment,
    eventChairCount:
      chairCounts.get(normalizeEventReference(assignment.eventId).toLowerCase()) ?? 0,
  }));
}

export async function getActiveEventRoles(userId: string, eventId: string) {
  const assignments = await getActiveEventRoleAssignments(userId);
  const normalizedEventId = normalizeEventReference(eventId);

  return assignments
    .filter(
      (assignment) => normalizeEventReference(assignment.eventId) === normalizedEventId,
    )
    .map((assignment) => assignment.role);
}

export async function listActiveRoleAssignments() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.sbRoleAssignments,
    [Query.equal("active", true), Query.limit(500)],
    undefined,
    false,
  );

  return result.rows.map((row) => toRoleAssignment(row as AppRow));
}

export async function listActiveEventRoleAssignments() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [Query.equal("active", true), Query.orderDesc("assignedAt"), Query.limit(500)],
    undefined,
    false,
  );

  return result.rows.map((row) => toEventRoleAssignment(row as AppRow));
}

export async function assignSbRole({
  actorUserId,
  role,
  userId,
}: {
  actorUserId: string;
  role: SbRole;
  userId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const rowId = roleRowId(userId, role);
  const assignedAt = new Date().toISOString();

  await requireRoleAssignableProfile(userId);

  let row: AppRow;

  try {
    await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.sbRoleAssignments,
      rowId,
    );

    row = await tables.updateRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.sbRoleAssignments,
      rowId,
      {
        active: true,
        assignedAt,
        assignedBy: actorUserId,
      },
    );
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }

    row = await tables.createRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.sbRoleAssignments,
      rowId,
      {
        active: true,
        assignedAt,
        assignedBy: actorUserId,
        role,
        userId,
      },
    );
  }

  await writeAuditLog({
    action: "SB_ROLE_ASSIGNED",
    actorUserId,
    metadata: { role },
    targetId: userId,
    targetType: "profile",
  });

  return toRoleAssignment(row);
}

export async function assignEventRole({
  actorUserId,
  committeeName,
  eventId,
  eventTitle,
  role,
  userId,
}: {
  actorUserId: string;
  committeeName?: string;
  eventId: string;
  eventTitle: string;
  role: EventRole;
  userId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const normalizedEventId = normalizeEventReference(eventId);
  const normalizedEventTitle = normalizeEventReference(eventTitle);
  const normalizedCommitteeName = normalizeCommitteeName(committeeName);

  await requireRoleAssignableProfile(userId);

  if (!normalizedEventId) {
    throw new Error("Event reference is required.");
  }

  if (!normalizedEventTitle) {
    throw new Error("Event title is required.");
  }

  if (requiresCommitteeName(role) && !normalizedCommitteeName) {
    throw new Error(`${role} assignments require a committee name.`);
  }

  const rowId = eventRoleRowId({
    committeeName: normalizedCommitteeName,
    eventId: normalizedEventId,
    role,
    userId,
  });
  const assignedAt = new Date().toISOString();
  const payload = {
    active: true,
    assignedAt,
    assignedBy: actorUserId,
    committeeName: normalizedCommitteeName ?? "",
    eventId: normalizedEventId,
    eventTitle: normalizedEventTitle,
    role,
    userId,
  };

  let row: AppRow;

  try {
    await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.eventRoleAssignments,
      rowId,
    );

    row = await tables.updateRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.eventRoleAssignments,
      rowId,
      payload,
    );
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }

    const existingRow = await findExistingEventRoleRow({
      active: true,
      committeeName: normalizedCommitteeName,
      eventId: normalizedEventId,
      role,
      userId,
    });

    if (existingRow) {
      row = await tables.updateRow<AppRow>(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.eventRoleAssignments,
        existingRow.$id,
        payload,
      );
    } else {
      row = await tables.createRow<AppRow>(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.eventRoleAssignments,
        rowId,
        payload,
      );
    }
  }

  await writeAuditLog({
    action: "EVENT_ROLE_ASSIGNED",
    actorUserId,
    metadata: {
      committeeName: normalizedCommitteeName ?? null,
      eventId: normalizedEventId,
      eventTitle: normalizedEventTitle,
      role,
    },
    targetId: userId,
    targetType: "profile",
  });

  return toEventRoleAssignment(row);
}

export async function revokeSbRole({
  actorUserId,
  role,
  userId,
}: {
  actorUserId: string;
  role: SbRole;
  userId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const rowId = roleRowId(userId, role);
  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.sbRoleAssignments,
    rowId,
    {
      active: false,
      revokedAt: new Date().toISOString(),
    },
  );

  await writeAuditLog({
    action: "SB_ROLE_REVOKED",
    actorUserId,
    metadata: { role },
    targetId: userId,
    targetType: "profile",
  });

  return toRoleAssignment(row);
}

export async function revokeEventRole({
  actorUserId,
  assignmentId,
}: {
  actorUserId: string;
  assignmentId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    assignmentId,
    {
      active: false,
      revokedAt: new Date().toISOString(),
    },
  );
  const assignment = toEventRoleAssignment(row);

  await writeAuditLog({
    action: "EVENT_ROLE_REVOKED",
    actorUserId,
    metadata: {
      assignmentId,
      committeeName: assignment.committeeName ?? null,
      eventId: assignment.eventId,
      eventTitle: assignment.eventTitle,
      role: assignment.role,
    },
    targetId: assignment.userId,
    targetType: "profile",
  });

  return assignment;
}
