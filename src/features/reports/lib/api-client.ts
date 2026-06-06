import type { ConclusionReport, ReportApproval } from "@/features/reports/types";
import type {
  ApproveConclusionReportInput,
  CreateConclusionReportInput,
  UpdateConclusionReportInput,
} from "@/features/reports/lib/validation";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export async function listConclusionReportsRequest() {
  const response = await fetch("/api/reports/conclusions");
  const payload = await parseResponse<{ reports: ConclusionReport[] }>(response);
  return payload.reports;
}

export async function createConclusionReportRequest(input: CreateConclusionReportInput) {
  const response = await fetch("/api/reports/conclusions", {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = await parseResponse<{ report: ConclusionReport }>(response);
  return payload.report;
}

export async function updateConclusionReportRequest(
  reportId: string,
  input: UpdateConclusionReportInput,
) {
  const response = await fetch(`/api/reports/conclusions/${reportId}`, {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  const payload = await parseResponse<{ report: ConclusionReport }>(response);
  return payload.report;
}

export async function reviewConclusionReportRequest(
  reportId: string,
  input: ApproveConclusionReportInput,
) {
  const response = await fetch(`/api/reports/conclusions/${reportId}/review`, {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = await parseResponse<{
    approval: ReportApproval;
    report: ConclusionReport;
  }>(response);
  return payload;
}

export async function reopenConclusionReportRequest(reportId: string) {
  const response = await fetch(`/api/reports/conclusions/${reportId}`, {
    body: JSON.stringify({ status: "DRAFT" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  const payload = await parseResponse<{ report: ConclusionReport }>(response);
  return payload.report;
}
