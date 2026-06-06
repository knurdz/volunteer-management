import {
  canApproveReport,
  canExportConclusionReport,
  canSubmitReport,
  canTransitionReportStatus,
} from "@/features/reports/lib/approval-rules";
import {
  MOCK_CONCLUSION_REPORTS,
  MOCK_REPORT_APPROVALS,
} from "@/features/reports/lib/mock-data";
import type {
  ApproveConclusionReportInput,
  CreateConclusionReportInput,
  UpdateConclusionReportInput,
} from "@/features/reports/lib/validation";
import type { ConclusionReport, ReportApproval } from "@/features/reports/types";

function cloneReports() {
  return structuredClone(MOCK_CONCLUSION_REPORTS);
}

function cloneApprovals() {
  return structuredClone(MOCK_REPORT_APPROVALS);
}

let reports = cloneReports();
let approvals = cloneApprovals();

export function resetMockRepository() {
  reports = cloneReports();
  approvals = cloneApprovals();
}

export function listConclusionReports() {
  return [...reports].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function getConclusionReport(reportId: string) {
  return reports.find((report) => report.$id === reportId) ?? null;
}

export function getConclusionReportByEvent(eventId: string) {
  return reports.find((report) => report.eventId === eventId) ?? null;
}

export function getReportApproval(reportId: string) {
  return approvals.find((approval) => approval.reportId === reportId) ?? null;
}

export function createConclusionReport(
  input: CreateConclusionReportInput & {
    submittedBy: string;
    submittedByName: string;
  },
) {
  const existing = getConclusionReportByEvent(input.eventId);

  if (existing) {
    throw new Error("A conclusion report already exists for this event.");
  }

  const now = new Date().toISOString();
  const report: ConclusionReport = {
    $id: `report-${crypto.randomUUID().slice(0, 8)}`,
    content: input.content,
    createdAt: now,
    eventId: input.eventId,
    eventTitle: input.eventTitle,
    status: "DRAFT",
    submittedBy: input.submittedBy,
    submittedByName: input.submittedByName,
    updatedAt: now,
  };

  reports.push(report);
  return report;
}

export function updateConclusionReport(
  reportId: string,
  input: UpdateConclusionReportInput,
) {
  const report = getConclusionReport(reportId);

  if (!report) {
    throw new Error("Conclusion report was not found.");
  }

  if (input.status && !canTransitionReportStatus(report.status, input.status)) {
    throw new Error(`Cannot move report from ${report.status} to ${input.status}.`);
  }

  if (input.status === "SUBMITTED" && !canSubmitReport(report)) {
    throw new Error("Report content is incomplete and cannot be submitted.");
  }

  const nextContent = input.content ? { ...report.content, ...input.content } : report.content;

  if (input.status === "SUBMITTED") {
    const draftLike = { ...report, content: nextContent };

    if (!canSubmitReport(draftLike)) {
      throw new Error("Report content is incomplete and cannot be submitted.");
    }
  }

  const updated: ConclusionReport = {
    ...report,
    content: nextContent,
    status: input.status ?? report.status,
    submittedAt:
      input.status === "SUBMITTED" ? new Date().toISOString() : report.submittedAt,
    updatedAt: new Date().toISOString(),
  };

  reports = reports.map((entry) => (entry.$id === reportId ? updated : entry));
  return updated;
}

export function reviewConclusionReport(
  reportId: string,
  input: ApproveConclusionReportInput & {
    reviewedBy: string;
    reviewedByName: string;
  },
) {
  const report = getConclusionReport(reportId);

  if (!report) {
    throw new Error("Conclusion report was not found.");
  }

  if (!canApproveReport(report)) {
    throw new Error("Only submitted reports can be reviewed.");
  }

  const nextStatus = input.status;
  const updated = updateConclusionReport(reportId, { status: nextStatus });
  const approval: ReportApproval = {
    $id: `approval-${crypto.randomUUID().slice(0, 8)}`,
    reportId,
    reviewNote: input.reviewNote,
    reviewedAt: new Date().toISOString(),
    reviewedBy: input.reviewedBy,
    reviewedByName: input.reviewedByName,
    status: nextStatus,
  };

  approvals = [
    ...approvals.filter((entry) => entry.reportId !== reportId),
    approval,
  ];

  return { approval, report: updated };
}

export function assertConclusionReportExportable(reportId: string) {
  const report = getConclusionReport(reportId);

  if (!report) {
    throw new Error("Conclusion report was not found.");
  }

  if (!canExportConclusionReport(report)) {
    throw new Error("Conclusion report exports are available only after approval.");
  }

  return report;
}
