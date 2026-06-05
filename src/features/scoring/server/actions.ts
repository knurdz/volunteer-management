"use server";

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
} from "../lib/helpers";
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

  if (!user.isAdmin) {
    const isChair = hasEventRole(user, data.eventId, "Chair");
    if (!isChair) {
      throw new Error("Only event chairs and admins can manage participation records.");
    }
  }

  const existing = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.participationRecords,
    [
      Query.equal("userId", data.userId),
      Query.equal("eventId", data.eventId),
      Query.limit(1),
    ]
  );

  const now = new Date().toISOString();

  if (existing.total > 0) {
    const row = await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.participationRecords,
      existing.rows[0].$id,
      {
        role: data.role,
        status: data.status,
        updatedAt: now,
      }
    );
    return row as unknown as ParticipationRecord;
  } else {
    const row = await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.participationRecords,
      ID.unique(),
      {
        userId: data.userId,
        eventId: data.eventId,
        role: data.role,
        status: data.status,
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

  if (!user.isAdmin) {
    const isLead = hasEventRole(user, data.eventId, ["Chair", "Committee Lead"]);
    if (!isLead) {
      throw new Error("Only event leads and chairs can submit grading requests.");
    }

    const chairEventIds = user.eventRoles
      .filter((assignment) => assignment.active && assignment.role === "Chair")
      .map((assignment) => assignment.eventId);

    if (isSelfEventGrade(graderId, data.eventId, chairEventIds)) {
      throw new Error("Chairs cannot grade participants under their own event.");
    }
  }

  const existingRequests = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    [
      Query.equal("eventId", data.eventId),
      Query.equal("targetUserId", data.targetUserId),
      Query.limit(1),
    ]
  );

  const now = new Date().toISOString();
  let requestId: string;

  if (existingRequests.total === 0) {
    requestId = ID.unique();
    await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeRequests,
      requestId,
      {
        requestId,
        eventId: data.eventId,
        requestedBy: graderId,
        targetUserId: data.targetUserId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      }
    );
  } else {
    requestId = existingRequests.rows[0].$id;
  }

  // Manage the review record for this grader
  const existingReviews = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeReviews,
    [
      Query.equal("gradeRequestId", requestId),
      Query.equal("reviewerId", graderId),
      Query.limit(1),
    ]
  );

  if (existingReviews.total > 0) {
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      existingReviews.rows[0].$id,
      {
        gradeValue: data.gradeValue,
        submittedAt: now,
      }
    );
  } else {
    await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      ID.unique(),
      {
        gradeRequestId: requestId,
        reviewerId: graderId,
        gradeValue: data.gradeValue,
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

/**
 * Lists grade requests scoped by user's roles.
 */
export async function listGradeRequests() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    [Query.limit(500)]
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

  const gradeRequest = (await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId
  )) as unknown as GradeRequest;

  if (!user.isAdmin) {
    const hasRole = user.eventRoles.some(
      (assignment) => assignment.active && assignment.eventId === gradeRequest.eventId
    );
    if (!hasRole) {
      throw new Error("Only authorized event reviewers or admins can submit reviews.");
    }

    const chairEventIds = user.eventRoles
      .filter((assignment) => assignment.active && assignment.role === "Chair")
      .map((assignment) => assignment.eventId);

    if (isSelfEventGrade(graderId, gradeRequest.eventId, chairEventIds)) {
      throw new Error("Chairs cannot grade participants under their own event.");
    }
  }

  const existingReviews = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeReviews,
    [
      Query.equal("gradeRequestId", gradeRequestId),
      Query.equal("reviewerId", graderId),
      Query.limit(1),
    ]
  );

  const now = new Date().toISOString();

  if (existingReviews.total > 0) {
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      existingReviews.rows[0].$id,
      {
        gradeValue,
        submittedAt: now,
      }
    );
  } else {
    await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      ID.unique(),
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
 */
async function recalculateLedgerEntries(
  tables: TablesDB,
  databaseId: string,
  gradeRequest: GradeRequest,
  averageGrade: number,
  conclusionApprovalDate: string,
  createdBy: string
) {
  // Clear any existing entries for this event and target user to keep it idempotent
  const existingEntries = await tables.listRows(databaseId, APPWRITE_TABLES.pointLedger, [
    Query.equal("userId", gradeRequest.targetUserId),
    Query.equal("eventId", gradeRequest.eventId),
    Query.limit(100),
  ]);

  for (const row of existingEntries.rows) {
    await tables.deleteRow(databaseId, APPWRITE_TABLES.pointLedger, row.$id);
  }

  const now = new Date().toISOString();

  // Create grade point entry
  await tables.createRow(databaseId, APPWRITE_TABLES.pointLedger, ID.unique(), {
    userId: gradeRequest.targetUserId,
    eventId: gradeRequest.eventId,
    points: averageGrade,
    conclusionApprovalDate,
    source: "grade",
    createdBy,
    createdAt: now,
  });

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

  if (rolePoints > 0) {
    await tables.createRow(databaseId, APPWRITE_TABLES.pointLedger, ID.unique(), {
      userId: gradeRequest.targetUserId,
      eventId: gradeRequest.eventId,
      points: rolePoints,
      conclusionApprovalDate,
      source: "role",
      createdBy,
      createdAt: now,
    });
  }
}

/**
 * Finalizes a grade request. Averages all grader reviews, allocates points, and records ledger entries.
 * Scoped to Admin, or authorized reviewer (own event). Chairs cannot grade own event.
 */
export async function finalizeGrade(gradeRequestId: string, conclusionApprovalDate?: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();
  const graderId = user.authUser.id;

  const gradeRequest = (await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId
  )) as unknown as GradeRequest;

  if (!user.isAdmin) {
    const hasRole = user.eventRoles.some(
      (assignment) => assignment.active && assignment.eventId === gradeRequest.eventId
    );
    if (!hasRole) {
      throw new Error("Only authorized event reviewers or admins can finalize grades.");
    }

    const chairEventIds = user.eventRoles
      .filter((assignment) => assignment.active && assignment.role === "Chair")
      .map((assignment) => assignment.eventId);

    if (isSelfEventGrade(graderId, gradeRequest.eventId, chairEventIds)) {
      throw new Error("Chairs cannot grade participants under their own event.");
    }
  }

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
  const approvalDate = conclusionApprovalDate || new Date().toISOString();

  // Recalculate ledger entries
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

  const review = (await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeReviews,
    gradeReviewId
  )) as unknown as GradeReview;

  const originalValue = review.gradeValue;
  const now = new Date().toISOString();

  const auditEntry: GradeAuditEntry = {
    originalValue,
    newValue: newGradeValue,
    changedBy: changerId,
    changedAt: now,
    reason,
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
    gradeReviewId,
    {
      gradeValue: newGradeValue,
      audit_metadata: JSON.stringify(auditList),
    }
  );

  // Write systemic audit log
  await writeAuditLog({
    action: "GRADE_OVERRIDDEN" as unknown as AuditAction,
    actorUserId: changerId,
    metadata: {
      gradeReviewId,
      originalValue,
      newValue: newGradeValue,
      reason,
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
export async function getVolunteerPoints(userId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();

  if (!user.isAdmin && user.authUser.id !== userId) {
    throw new Error("Unauthorized access to point ledger.");
  }

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.pointLedger,
    [Query.equal("userId", userId), Query.limit(500)]
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

  const existing = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.termScoringConfig,
    [
      Query.equal("userId", data.userId),
      Query.equal("term", data.term),
      Query.equal("year", data.year),
      Query.limit(1),
    ]
  );

  if (existing.total > 0) {
    const row = await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.termScoringConfig,
      existing.rows[0].$id,
      {
        excludedFromTopBoard: data.excluded,
        reason: data.reason || "",
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
        userId: data.userId,
        term: data.term,
        year: data.year,
        excludedFromTopBoard: data.excluded,
        reason: data.reason || "",
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
  if (params.month !== undefined && params.year !== undefined) {
    entries = filterLedgerByMonth(entries, params.month, params.year);
  } else if (params.term !== undefined && params.year !== undefined) {
    entries = filterLedgerByTerm(entries, params.term, params.year);
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
      params.term || "",
      params.year || 0,
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
