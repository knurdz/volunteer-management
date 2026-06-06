import type { ConclusionReport, ReportStatus } from "@/features/reports/types";

const transitions: Record<ReportStatus, ReportStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: [],
  REJECTED: ["DRAFT", "SUBMITTED"],
};

export function canTransitionReportStatus(
  current: ReportStatus,
  next: ReportStatus,
) {
  return transitions[current].includes(next);
}

export function canSubmitReport(report: Pick<ConclusionReport, "status" | "content">) {
  if (report.status !== "DRAFT" && report.status !== "REJECTED") {
    return false;
  }

  return hasRequiredContent(report.content);
}

export function canApproveReport(report: Pick<ConclusionReport, "status">) {
  return report.status === "SUBMITTED";
}

export function canExportConclusionReport(report: Pick<ConclusionReport, "status">) {
  return report.status === "APPROVED";
}

export function hasRequiredContent(
  content: Pick<
    ConclusionReport["content"],
    "objectives" | "outcomes" | "recommendations"
  >,
) {
  return (
    content.objectives.trim().length > 0 &&
    content.outcomes.trim().length > 0 &&
    content.recommendations.trim().length > 0
  );
}

export function reportStatusTone(
  status: ReportStatus,
): "neutral" | "primary" | "success" | "warning" | "danger" {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "SUBMITTED":
      return "warning";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
  }
}
