import "server-only";

import { ID, Query, type Models } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import {
  hasEventRole,
  normalizeEventReference,
} from "@/features/access-control/lib/rules";
import type { SessionUser } from "@/features/access-control/types";
import {
  canApproveReport,
  canEditReportContent,
  canExportConclusionReport,
  canSubmitReport,
  canTransitionReportStatus,
  hasRequiredContent,
} from "@/features/reports/lib/approval-rules";
import type {
  ApproveConclusionReportInput,
  CreateConclusionReportInput,
  DraftContentInput,
  UpdateConclusionReportInput,
} from "@/features/reports/lib/validation";
import type { ConclusionReport, ConclusionReportContent, ReportApproval } from "@/features/reports/types";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { isAppwriteNotFound } from "@/server/errors";

type AppRow = Models.Row & Record<string, unknown>;

const EVENT_LEAD_ROLES = ["Chair", "Vice Chair"] as const;
const CONTENT_COLUMN_MAX_LENGTH = 12000;

function emptyContent(): ConclusionReportContent {
  return {
    attendanceNotes: "",
    challenges: "",
    objectives: "",
    outcomes: "",
    recommendations: "",
  };
}

function toContent(row: AppRow): ConclusionReportContent {
  if (typeof row.content === "string" && row.content) {
    try {
      const parsed = JSON.parse(row.content) as Partial<ConclusionReportContent>;

      return {
        attendanceNotes: parsed.attendanceNotes ?? "",
        challenges: parsed.challenges ?? "",
        objectives: parsed.objectives ?? "",
        outcomes: parsed.outcomes ?? "",
        recommendations: parsed.recommendations ?? "",
      };
    } catch {
      throw new Error(`Invalid report content stored for report ${row.$id}.`);
    }
  }

  return {
    attendanceNotes: String(row.attendanceNotes ?? ""),
    challenges: String(row.challenges ?? ""),
    objectives: String(row.objectives ?? ""),
    outcomes: String(row.outcomes ?? ""),
    recommendations: String(row.recommendations ?? ""),
  };
}

function contentToRow(content: ConclusionReportContent) {
  const serialized = JSON.stringify(content);

  if (serialized.length > CONTENT_COLUMN_MAX_LENGTH) {
    throw new Error("Report content is too long to save.");
  }

  return { content: serialized };
}

export function toConclusionReport(row: AppRow): ConclusionReport {
  return {
    $id: row.$id,
    content: toContent(row),
    createdAt: String(row.createdAt),
    eventId: String(row.eventId),
    eventTitle: String(row.eventTitle),
    status: String(row.status) as ConclusionReport["status"],
    submittedAt:
      typeof row.submittedAt === "string" && row.submittedAt ? row.submittedAt : undefined,
    submittedBy: String(row.submittedBy),
    submittedByName: String(row.submittedByName),
    updatedAt: String(row.updatedAt),
  };
}

export function toReportApproval(row: AppRow): ReportApproval {
  return {
    $id: row.$id,
    reportId: String(row.reportId),
    reviewNote:
      typeof row.reviewNote === "string" && row.reviewNote ? row.reviewNote : undefined,
    reviewedAt: String(row.reviewedAt),
    reviewedBy: String(row.reviewedBy),
    reviewedByName: String(row.reviewedByName),
    status: String(row.status) as ReportApproval["status"],
  };
}

async function resolveEventTitle(user: SessionUser, eventId: string) {
  const normalizedEventId = normalizeEventReference(eventId);
  const assignment = user.eventRoles.find(
    (entry) =>
      entry.active && normalizeEventReference(entry.eventId) === normalizedEventId,
  );

  if (assignment?.eventTitle) {
    return assignment.eventTitle;
  }

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [Query.equal("eventId", normalizedEventId), Query.equal("active", true), Query.limit(1)],
    undefined,
    false,
  );
  const row = result.rows[0] as AppRow | undefined;

  if (row && typeof row.eventTitle === "string" && row.eventTitle) {
    return String(row.eventTitle);
  }

  throw new Error("Event title could not be resolved for the selected event.");
}

export function canManageConclusionReport(user: SessionUser, eventId: string) {
  return (
    user.isAdmin ||
    hasEventRole(user, eventId, [...EVENT_LEAD_ROLES])
  );
}

export function canViewConclusionReport(user: SessionUser, report: ConclusionReport) {
  if (user.isAdmin) {
    return true;
  }

  if (report.submittedBy === user.authUser.id) {
    return true;
  }

  return hasEventRole(user, report.eventId, [...EVENT_LEAD_ROLES]);
}

export function canExportConclusionReportPdf(user: SessionUser, report: ConclusionReport) {
  return (
    user.isAdmin || hasEventRole(user, report.eventId, [...EVENT_LEAD_ROLES])
  );
}

async function getConclusionReportRow(reportId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  try {
    const row = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.conclusionReports,
      reportId,
    );

    return row as AppRow;
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function listConclusionReports() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.conclusionReports,
    [Query.orderDesc("updatedAt"), Query.limit(500)],
    undefined,
    false,
  );

  return result.rows.map((row) => toConclusionReport(row as AppRow));
}

export async function listConclusionReportsForUser(user: SessionUser) {
  const reports = await listConclusionReports();
  return reports.filter((report) => canViewConclusionReport(user, report));
}

export async function getConclusionReport(reportId: string) {
  const row = await getConclusionReportRow(reportId);
  return row ? toConclusionReport(row) : null;
}

export async function getConclusionReportByEvent(eventId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const normalizedEventId = normalizeEventReference(eventId);
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.conclusionReports,
    [Query.equal("eventId", normalizedEventId), Query.limit(1)],
    undefined,
    false,
  );

  const row = result.rows[0] as AppRow | undefined;
  return row ? toConclusionReport(row) : null;
}

export async function getReportApproval(reportId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.reportApprovals,
    [Query.equal("reportId", reportId), Query.orderDesc("reviewedAt"), Query.limit(1)],
    undefined,
    false,
  );

  const row = result.rows[0] as AppRow | undefined;
  return row ? toReportApproval(row) : null;
}

function mergeDraftContent(
  current: ConclusionReportContent,
  input?: DraftContentInput,
): ConclusionReportContent {
  if (!input) {
    return current;
  }

  return {
    attendanceNotes: input.attendanceNotes ?? current.attendanceNotes,
    challenges: input.challenges ?? current.challenges,
    objectives: input.objectives ?? current.objectives,
    outcomes: input.outcomes ?? current.outcomes,
    recommendations: input.recommendations ?? current.recommendations,
  };
}

export async function createConclusionReportRecord(
  user: SessionUser,
  input: CreateConclusionReportInput,
) {
  if (!canManageConclusionReport(user, input.eventId)) {
    throw new Error("Required event role is missing.");
  }

  const normalizedEventId = normalizeEventReference(input.eventId);
  const existing = await getConclusionReportByEvent(normalizedEventId);

  if (existing) {
    throw new Error("A conclusion report already exists for this event.");
  }

  const now = new Date().toISOString();
  const eventTitle = await resolveEventTitle(user, normalizedEventId);
  const content = mergeDraftContent(emptyContent(), input.content);
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const row = await tables.createRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.conclusionReports,
    ID.unique(),
    {
      ...contentToRow(content),
      createdAt: now,
      eventId: normalizedEventId,
      eventTitle,
      status: "DRAFT",
      submittedBy: user.authUser.id,
      submittedByName: user.authUser.name || user.authUser.email,
      updatedAt: now,
    },
  );

  await writeAuditLog({
    action: "CONCLUSION_REPORT_CREATED",
    actorUserId: user.authUser.id,
    metadata: { eventId: normalizedEventId, eventTitle },
    targetId: row.$id,
    targetType: "conclusion_report",
  });

  return toConclusionReport(row);
}

async function updateConclusionReportRow(
  reportId: string,
  payload: Record<string, unknown>,
) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.conclusionReports,
    reportId,
    {
      ...payload,
      updatedAt: new Date().toISOString(),
    },
  );

  return toConclusionReport(row);
}

export async function updateConclusionReportRecord(
  user: SessionUser,
  reportId: string,
  input: UpdateConclusionReportInput,
) {
  const report = await getConclusionReport(reportId);

  if (!report) {
    throw new Error("Conclusion report was not found.");
  }

  if (!canManageConclusionReport(user, report.eventId)) {
    throw new Error("Required event role is missing.");
  }

  if (input.content && !canEditReportContent(report)) {
    throw new Error("Submitted and approved reports cannot be edited.");
  }

  if (input.status && !canTransitionReportStatus(report.status, input.status)) {
    throw new Error(`Cannot move report from ${report.status} to ${input.status}.`);
  }

  const nextContent = mergeDraftContent(report.content, input.content);
  const draftLike = { ...report, content: nextContent };

  if (input.status === "SUBMITTED" && !canSubmitReport(draftLike)) {
    throw new Error("Report content is incomplete and cannot be submitted.");
  }

  const payload: Record<string, unknown> = {
    ...contentToRow(nextContent),
  };

  if (input.status) {
    payload.status = input.status;

    if (input.status === "SUBMITTED") {
      payload.submittedAt = new Date().toISOString();
    }
  }

  const updated = await updateConclusionReportRow(reportId, payload);

  await writeAuditLog({
    action: "CONCLUSION_REPORT_UPDATED",
    actorUserId: user.authUser.id,
    metadata: {
      eventId: report.eventId,
      status: updated.status,
    },
    targetId: reportId,
    targetType: "conclusion_report",
  });

  return updated;
}

export async function reopenConclusionReportRecord(user: SessionUser, reportId: string) {
  if (!user.isAdmin) {
    throw new Error("Admin access required.");
  }

  const report = await getConclusionReport(reportId);

  if (!report) {
    throw new Error("Conclusion report was not found.");
  }

  if (report.status === "DRAFT") {
    return report;
  }

  if (!canTransitionReportStatus(report.status, "DRAFT")) {
    throw new Error(`Cannot move report from ${report.status} to DRAFT.`);
  }

  const updated = await updateConclusionReportRow(reportId, { status: "DRAFT" });

  await writeAuditLog({
    action: "CONCLUSION_REPORT_REOPENED",
    actorUserId: user.authUser.id,
    metadata: { eventId: report.eventId, previousStatus: report.status },
    targetId: reportId,
    targetType: "conclusion_report",
  });

  return updated;
}

export async function reviewConclusionReportRecord(
  user: SessionUser,
  reportId: string,
  input: ApproveConclusionReportInput,
) {
  if (!user.isAdmin) {
    throw new Error("Admin access required.");
  }

  const report = await getConclusionReport(reportId);

  if (!report) {
    throw new Error("Conclusion report was not found.");
  }

  if (!canApproveReport(report)) {
    throw new Error("Only submitted reports can be reviewed.");
  }

  if (report.submittedBy === user.authUser.id) {
    throw new Error("Submitters cannot review their own report.");
  }

  if (!hasRequiredContent(report.content)) {
    throw new Error("Report content is incomplete and cannot be reviewed.");
  }

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const reviewedAt = new Date().toISOString();
  const updated = await updateConclusionReportRow(reportId, {
    status: input.status,
  });

  const existingApproval = await getReportApproval(reportId);

  let approvalRow: AppRow;

  if (existingApproval) {
    approvalRow = await tables.updateRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.reportApprovals,
      existingApproval.$id,
      {
        reviewNote: input.reviewNote ?? "",
        reviewedAt,
        reviewedBy: user.authUser.id,
        reviewedByName: user.authUser.name || user.authUser.email,
        status: input.status,
      },
    );
  } else {
    approvalRow = await tables.createRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.reportApprovals,
      ID.unique(),
      {
        reportId,
        reviewNote: input.reviewNote ?? "",
        reviewedAt,
        reviewedBy: user.authUser.id,
        reviewedByName: user.authUser.name || user.authUser.email,
        status: input.status,
      },
    );
  }

  await writeAuditLog({
    action: "CONCLUSION_REPORT_REVIEWED",
    actorUserId: user.authUser.id,
    metadata: {
      eventId: report.eventId,
      reviewStatus: input.status,
    },
    targetId: reportId,
    targetType: "conclusion_report",
  });

  return {
    approval: toReportApproval(approvalRow),
    report: updated,
  };
}

export async function assertConclusionReportExportable(reportId: string) {
  const report = await getConclusionReport(reportId);

  if (!report) {
    throw new Error("Conclusion report was not found.");
  }

  if (!canExportConclusionReport(report)) {
    throw new Error("Conclusion report exports are available only after approval.");
  }

  const approval = await getReportApproval(reportId);

  if (!approval || approval.status !== "APPROVED") {
    throw new Error("A matching approval record is required before export.");
  }

  return { approval, report };
}
