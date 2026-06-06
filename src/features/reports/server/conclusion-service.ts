import {
  assertConclusionReportExportable,
  createConclusionReport,
  getConclusionReport,
  getReportApproval,
  listConclusionReports,
  reviewConclusionReport,
  updateConclusionReport,
} from "@/features/reports/lib/mock-repository";
import type {
  ApproveConclusionReportInput,
  CreateConclusionReportInput,
  UpdateConclusionReportInput,
} from "@/features/reports/lib/validation";

export {
  assertConclusionReportExportable,
  getConclusionReport,
  getReportApproval,
  listConclusionReports,
};

export function createConclusionReportRecord(
  input: CreateConclusionReportInput & {
    submittedBy: string;
    submittedByName: string;
  },
) {
  return createConclusionReport(input);
}

export function updateConclusionReportRecord(
  reportId: string,
  input: UpdateConclusionReportInput,
) {
  return updateConclusionReport(reportId, input);
}

export function reviewConclusionReportRecord(
  reportId: string,
  input: ApproveConclusionReportInput & {
    reviewedBy: string;
    reviewedByName: string;
  },
) {
  return reviewConclusionReport(reportId, input);
}
