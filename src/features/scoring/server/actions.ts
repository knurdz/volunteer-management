"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { ID, Query, TablesDB } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { requireAuth, requireAdmin } from "@/features/access-control/server/current-user";
import { hasEventRole } from "@/features/access-control/lib/rules";
import { ROLE_BASE_POINTS } from "@/lib/config";
import { getServerEnv } from "@/lib/env";
import type { AuditAction } from "@/features/access-control/types";

import {
  calculateAverageGrade,
  filterLedgerByMonth,
  filterLedgerByTerm,
  isEligibleForTopBoard,
  isSelfEventGrade,
  sumPointsFromLedger,
  deriveTermFromDate,
} from "../lib/helpers";
import {
  ParticipationRecordSchema,
  GradeRequestSchema,
  AdminGradeOverrideSchema,
  TermSchema,
  YearSchema,
  MonthSchema,
} from "../lib/schemas";
import type {
  ParticipationRecord,
  ParticipationStatus,
  GradeRequest,
  GradeReview,
  PointLedgerEntry,
  TermScoringConfig,
  GradeAuditEntry,
} from "../types";

/**
 * Upserts a volunteer's participation record for an event.
 * Scoped to Admin, or Chair of the event only.
 */
export async function upsertParticipationRecord(data: {
  userId: string;
  eventId: string;
  role: string;
  status: ParticipationStatus;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();

  const validated = ParticipationRecordSchema.parse(data);

  if (!user.isAdmin) {
    const isChair = hasEventRole(user, validated.eventId, "Chair");
    if (!isChair) {
      throw new Error("Only event chairs and admins can manage participation records.");
    }
  }

  const rowId = `pr_${createHash("sha1").update(`${validated.userId}:${validated.eventId}`).digest("hex").slice(0, 30)}`;
  const now = new Date().toISOString();

  try {
    await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.participationRecords,
      rowId
    );
    const row = await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.participationRecords,
      rowId,
      {
        role: validated.role,
        status: validated.status,
        updatedAt: now,
      }
    );
    return row as unknown as ParticipationRecord;
  } catch {
    const row = await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.participationRecords,
      rowId,
      {
        userId: validated.userId,
        eventId: validated.eventId,
        role: validated.role,
        status: validated.status,
        createdAt: now,
        updatedAt: now,
      }
    );
    return row as unknown as ParticipationRecord;
  }
}

/**
 * Submits/Creates a grade request for a participant.
 * Scoped to Chair or Event Lead of the event (Chairs cannot grade their own event participants).
 */
export async function createGradeRequest(data: {
  eventId: string;
  targetUserId: string;
  gradeValue: number;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();
  const graderId = user.authUser.id;

  const validated = GradeRequestSchema.parse(data);

  if (!user.isAdmin) {
    const isLead = hasEventRole(user, validated.eventId, ["Chair", "Vice Chair", "Committee Lead"]);
    if (!isLead) {
      throw new Error("Only event leads and chairs can submit grading requests.");
    }

    const chairEventIds = user.eventRoles
      .filter((assignment) => assignment.active && assignment.role === "Chair")
      .map((assignment) => assignment.eventId);

    if (isSelfEventGrade(graderId, validated.eventId, chairEventIds)) {
      throw new Error("Chairs cannot grade participants under their own event.");
    }
  }

  // Verify target is a participant of the event
  const participationResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.participationRecords,
    [
      Query.equal("userId", validated.targetUserId),
      Query.equal("eventId", validated.eventId),
      Query.limit(1),
    ]
  );

  if (participationResult.total === 0) {
    throw new Error("Target user is not a participant in this event.");
  }

  const requestId = `gr_${createHash("sha1").update(`${validated.eventId}:${validated.targetUserId}`).digest("hex").slice(0, 30)}`;
  const now = new Date().toISOString();

  // Check if finalized
  try {
    const existing = (await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeRequests,
      requestId
    )) as unknown as GradeRequest;

    if (existing.status === "finalized") {
      throw new Error("Cannot modify a finalized grade request.");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Cannot modify a finalized grade request.") {
      throw err;
    }
    // Otherwise, create request row
    await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeRequests,
      requestId,
      {
        requestId,
        eventId: validated.eventId,
        requestedBy: graderId,
        targetUserId: validated.targetUserId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      }
    );
  }

  const reviewId = `rev_${createHash("sha1").update(`${requestId}:${graderId}`).digest("hex").slice(0, 28)}`;

  try {
    await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId
    );
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId,
      {
        gradeValue: validated.gradeValue,
        submittedAt: now,
      }
    );
  } catch {
    await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId,
      {
        gradeRequestId: requestId,
        reviewerId: graderId,
        gradeValue: validated.gradeValue,
        submittedAt: now,
      }
    );
  }

  // Update status of grade request
  const updatedRequest = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    requestId,
    {
      status: "submitted",
      updatedAt: now,
    }
  );

  return updatedRequest as unknown as GradeRequest;
}

export async function listGradeRequests(params?: { limit?: number; offset?: number }) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();

  const limit = params?.limit !== undefined ? z.number().int().min(1).max(500).parse(params.limit) : 500;
  const offset = params?.offset !== undefined ? z.number().int().min(0).parse(params.offset) : 0;

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc("updatedAt"),
    ]
  );

  if (user.isAdmin) {
    return result.rows as unknown as GradeRequest[];
  }

  const userEventIds = user.eventRoles.map((r) => r.eventId);
  return (result.rows as unknown as GradeRequest[]).filter((row) =>
    userEventIds.includes(row.eventId)
  );
}

/**
 * Submits or updates a grade review for a request.
 * Scoped to Admin, or authorized reviewer (own event). Chairs cannot grade own event.
 */
export async function submitGradeReview(gradeRequestId: string, gradeValue: number) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();
  const graderId = user.authUser.id;

  z.string().min(1).parse(gradeRequestId);
  z.number().int().min(0).max(10).parse(gradeValue);

  const gradeRequest = (await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId
  )) as unknown as GradeRequest;

  if (gradeRequest.status === "finalized") {
    throw new Error("Cannot submit review for a finalized grade request.");
  }

  if (!user.isAdmin) {
    const hasRole = hasEventRole(user, gradeRequest.eventId, ["Vice Chair", "Committee Lead"]);
    if (!hasRole) {
      throw new Error("Only authorized event reviewers or admins can submit reviews.");
    }
  }

  const reviewId = `rev_${createHash("sha1").update(`${gradeRequestId}:${graderId}`).digest("hex").slice(0, 28)}`;
  const now = new Date().toISOString();

  try {
    await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId
    );
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId,
      {
        gradeValue,
        submittedAt: now,
      }
    );
  } catch {
    await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId,
      {
        gradeRequestId,
        reviewerId: graderId,
        gradeValue,
        submittedAt: now,
      }
    );
  }

  const updatedRequest = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId,
    {
      status: "reviewed",
      updatedAt: now,
    }
  );

  return updatedRequest as unknown as GradeRequest;
}

/**
 * Recalculate points ledger entries for a finalized request.
 * Delta-based and append-only to preserve manual adjustments and audit history.
 */
async function recalculateLedgerEntries(
  tables: TablesDB,
  databaseId: string,
  gradeRequest: GradeRequest,
  averageGrade: number,
  conclusionApprovalDate: string,
  createdBy: string
) {
  const now = new Date().toISOString();
  const term = deriveTermFromDate(conclusionApprovalDate);

  // Read all existing ledger entries for this event and target user
  const existingEntries = await tables.listRows(databaseId, APPWRITE_TABLES.pointLedger, [
    Query.equal("userId", gradeRequest.targetUserId),
    Query.equal("eventId", gradeRequest.eventId),
    Query.limit(100),
  ]);

  const existingRows = existingEntries.rows as unknown as PointLedgerEntry[];

  // Sum points for each source
  const currentGradePoints = existingRows
    .filter((r) => r.source === "grade")
    .reduce((acc, r) => acc + Number(r.points), 0);

  const currentRolePoints = existingRows
    .filter((r) => r.source === "role")
    .reduce((acc, r) => acc + Number(r.points), 0);

  const targetGradePoints = averageGrade;

  // Create role point entry (lookup participation record)
  const participation = await tables.listRows(
    databaseId,
    APPWRITE_TABLES.participationRecords,
    [
      Query.equal("userId", gradeRequest.targetUserId),
      Query.equal("eventId", gradeRequest.eventId),
      Query.limit(1),
    ]
  );

  const role = participation.total > 0 ? participation.rows[0].role : null;
  const rolePoints = role ? (ROLE_BASE_POINTS[role as keyof typeof ROLE_BASE_POINTS] ?? 0) : 0;
  const targetRolePoints = rolePoints;

  // Append grade adjustment if there is a difference
  const gradeDiff = targetGradePoints - currentGradePoints;
  if (gradeDiff !== 0) {
    await tables.createRow(databaseId, APPWRITE_TABLES.pointLedger, ID.unique(), {
      userId: gradeRequest.targetUserId,
      eventId: gradeRequest.eventId,
      points: gradeDiff,
      conclusionApprovalDate,
      term,
      source: "grade",
      createdBy,
      createdAt: now,
    });
  }

  // Append role adjustment if there is a difference
  const roleDiff = targetRolePoints - currentRolePoints;
  if (roleDiff !== 0) {
    await tables.createRow(databaseId, APPWRITE_TABLES.pointLedger, ID.unique(), {
      userId: gradeRequest.targetUserId,
      eventId: gradeRequest.eventId,
      points: roleDiff,
      conclusionApprovalDate,
      term,
      source: "role",
      createdBy,
      createdAt: now,
    });
  }
}

/**
 * Finalizes a grade request. Averages all grader reviews, allocates points, and records ledger entries.
 * Scoped to Admin, Vice Chair, or Committee Lead only. Own-event grading restrictions apply.
 */
export async function finalizeGrade(gradeRequestId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();
  const graderId = user.authUser.id;

  z.string().min(1).parse(gradeRequestId);

  const gradeRequest = (await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId
  )) as unknown as GradeRequest;

  if (gradeRequest.status === "finalized") {
    throw new Error("Grade request is already finalized.");
  }

  if (!user.isAdmin) {
    const hasRole = hasEventRole(user, gradeRequest.eventId, ["Vice Chair", "Committee Lead"]);
    if (!hasRole) {
      throw new Error("Only authorized event reviewers or admins can finalize grades.");
    }
  }

  // Find Admin approved conclusion report for this event
  const approvalLogs = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.auditLogs,
    [
      Query.equal("action", "CONCLUSION_REPORT_APPROVED"),
      Query.equal("targetId", gradeRequest.eventId),
      Query.limit(1),
    ]
  );

  if (approvalLogs.total === 0) {
    throw new Error("Conclusion report for this event is not approved by Admin.");
  }

  const approvalDate = approvalLogs.rows[0].createdAt;

  // Fetch all reviews
  const reviewsResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeReviews,
    [Query.equal("gradeRequestId", gradeRequestId), Query.limit(100)]
  );

  if (reviewsResult.total === 0) {
    throw new Error("Cannot finalize grade request with zero reviews.");
  }

  const reviews = reviewsResult.rows as unknown as GradeReview[];
  const grades = reviews.map((r) => r.gradeValue);
  const averageGrade = calculateAverageGrade(grades);

  // Recalculate ledger entries (delta-based)
  await recalculateLedgerEntries(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    gradeRequest,
    averageGrade,
    approvalDate,
    graderId
  );

  // Update status of grade request
  const updatedRequest = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId,
    {
      status: "finalized",
      updatedAt: new Date().toISOString(),
    }
  );

  return updatedRequest as unknown as GradeRequest;
}

/**
 * Admin override for any grade review. Captures audit logs, preserves original value, and adjusts ledger if finalized.
 */
export async function adminOverrideGrade(
  gradeReviewId: string,
  newGradeValue: number,
  reason?: string
) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAdmin();
  const changerId = user.authUser.id;

  const validated = AdminGradeOverrideSchema.parse({
    gradeReviewId,
    newGradeValue,
    reason,
  });

  const review = (await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeReviews,
    validated.gradeReviewId
  )) as unknown as GradeReview;

  const originalValue = review.gradeValue;
  const now = new Date().toISOString();

  const auditEntry: GradeAuditEntry = {
    originalValue,
    newValue: validated.newGradeValue,
    changedBy: changerId,
    changedAt: now,
    reason: validated.reason,
  };

  let auditList: GradeAuditEntry[] = [];
  if (review.audit_metadata) {
    try {
      auditList = JSON.parse(review.audit_metadata);
      if (!Array.isArray(auditList)) {
        auditList = [];
      }
    } catch {
      auditList = [];
    }
  }
  auditList.push(auditEntry);

  // Update review value and audit list
  const updatedReview = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeReviews,
    validated.gradeReviewId,
    {
      gradeValue: validated.newGradeValue,
      audit_metadata: JSON.stringify(auditList),
    }
  );

  // Write systemic audit log
  await writeAuditLog({
    action: "GRADE_OVERRIDDEN" as unknown as AuditAction,
    actorUserId: changerId,
    metadata: {
      gradeReviewId: validated.gradeReviewId,
      originalValue,
      newValue: validated.newGradeValue,
      reason: validated.reason,
    },
    targetId: review.gradeRequestId,
    targetType: "grade_request",
  });

  // Recalculate average grade and update point ledger if finalized
  const gradeRequest = (await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    review.gradeRequestId
  )) as unknown as GradeRequest;

  if (gradeRequest.status === "finalized") {
    const reviewsResult = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      [Query.equal("gradeRequestId", review.gradeRequestId), Query.limit(100)]
    );
    const updatedReviews = reviewsResult.rows as unknown as GradeReview[];
    const grades = updatedReviews.map((r) => r.gradeValue);
    const newAverage = calculateAverageGrade(grades);

    // Get current finalized date from point_ledger
    const existingLedger = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.pointLedger,
      [
        Query.equal("userId", gradeRequest.targetUserId),
        Query.equal("eventId", gradeRequest.eventId),
        Query.equal("source", "grade"),
        Query.limit(1),
      ]
    );

    const approvalDate = existingLedger.total > 0
      ? existingLedger.rows[0].conclusionApprovalDate
      : now;

    await recalculateLedgerEntries(
      tables,
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      gradeRequest,
      newAverage,
      approvalDate,
      changerId
    );
  }

  return updatedReview as unknown as GradeReview;
}

/**
 * Fetches point ledger entries for a volunteer. Scoped to Admin or Self.
 */
export async function getVolunteerPoints(userId: string, params?: { limit?: number; offset?: number }) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();

  z.string().min(1).parse(userId);
  const limit = params?.limit !== undefined ? z.number().int().min(1).max(500).parse(params.limit) : 500;
  const offset = params?.offset !== undefined ? z.number().int().min(0).parse(params.offset) : 0;

  if (!user.isAdmin && user.authUser.id !== userId) {
    throw new Error("Unauthorized access to point ledger.");
  }

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.pointLedger,
    [
      Query.equal("userId", userId),
      Query.limit(limit),
      Query.offset(offset),
    ]
  );

  return result.rows as unknown as PointLedgerEntry[];
}

/**
 * Configures Top Board exclusions for a user. Admin-only.
 */
export async function toggleTopBoardExclusion(data: {
  userId: string;
  term: string;
  year: number;
  excluded: boolean;
  reason?: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAdmin();
  const changerId = user.authUser.id;

  const validated = z.object({
    userId: z.string().min(1),
    term: TermSchema,
    year: YearSchema,
    excluded: z.boolean(),
    reason: z.string().optional(),
  }).parse(data);

  const existing = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.termScoringConfig,
    [
      Query.equal("userId", validated.userId),
      Query.equal("term", validated.term),
      Query.equal("year", validated.year),
      Query.limit(1),
    ]
  );

  if (existing.total > 0) {
    const row = await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.termScoringConfig,
      existing.rows[0].$id,
      {
        excludedFromTopBoard: validated.excluded,
        reason: validated.reason || "",
        setBy: changerId,
      }
    );
    return row as unknown as TermScoringConfig;
  } else {
    const row = await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.termScoringConfig,
      ID.unique(),
      {
        userId: validated.userId,
        term: validated.term,
        year: validated.year,
        excludedFromTopBoard: validated.excluded,
        reason: validated.reason || "",
        setBy: changerId,
      }
    );
    return row as unknown as TermScoringConfig;
  }
}

/**
 * Fetches the ranked leaderboard, filtered by term, month, and/or year.
 */
export async function getLeaderboard(params: {
  term?: string;
  month?: number;
  year?: number;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  await requireAuth();

  const validated = z.object({
    term: TermSchema.optional(),
    month: MonthSchema.optional(),
    year: YearSchema.optional(),
  }).parse(params);

  const ledgerResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.pointLedger,
    [Query.limit(1000)]
  );
  let entries = ledgerResult.rows as unknown as PointLedgerEntry[];

  const configResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.termScoringConfig,
    [Query.limit(1000)]
  );
  const configs = configResult.rows as unknown as TermScoringConfig[];

  // Filter ledger
  if (validated.month !== undefined && validated.year !== undefined) {
    entries = filterLedgerByMonth(entries, validated.month, validated.year);
  } else if (validated.term !== undefined) {
    entries = filterLedgerByTerm(entries, validated.term);
  }

  // Aggregate user points
  const userMap = new Map<string, PointLedgerEntry[]>();
  for (const entry of entries) {
    if (!userMap.has(entry.userId)) {
      userMap.set(entry.userId, []);
    }
    userMap.get(entry.userId)!.push(entry);
  }

  const profilesResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.profiles,
    [Query.limit(500)]
  );
  const profileMap = new Map(profilesResult.rows.map((p) => [p.$id, p]));

  const leaderboard: { userId: string; name: string; points: number }[] = [];

  for (const [userId, userEntries] of userMap.entries()) {
    const isEligible = isEligibleForTopBoard(
      userId,
      validated.term || "",
      validated.year || 0,
      configs
    );

    if (isEligible) {
      const totalPoints = sumPointsFromLedger(userEntries);
      const name = profileMap.get(userId)?.name || "Unknown Volunteer";
      leaderboard.push({ userId, name, points: totalPoints });
    }
  }

  // Sort descending by points
  return leaderboard.sort((a, b) => b.points - a.points);
}
