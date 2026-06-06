import { describe, expect, it } from "vitest";
import {
  canEditReportContent,
  canExportConclusionReport,
  canSubmitReport,
  canTransitionReportStatus,
} from "@/features/reports/lib/approval-rules";

describe("report approval rules", () => {
  it("allows draft reports to move to submitted only when content is complete", () => {
    expect(canTransitionReportStatus("DRAFT", "SUBMITTED")).toBe(true);
    expect(
      canSubmitReport({
        content: {
          attendanceNotes: "",
          challenges: "",
          objectives: "Plan outreach",
          outcomes: "180 attendees",
          recommendations: "Reserve indoor backup space",
        },
        status: "DRAFT",
      }),
    ).toBe(true);
    expect(
      canSubmitReport({
        content: {
          attendanceNotes: "",
          challenges: "",
          objectives: "",
          outcomes: "",
          recommendations: "",
        },
        status: "DRAFT",
      }),
    ).toBe(false);
  });

  it("blocks conclusion exports until approval", () => {
    expect(canExportConclusionReport({ status: "SUBMITTED" })).toBe(false);
    expect(canExportConclusionReport({ status: "APPROVED" })).toBe(true);
  });

  it("allows editing only for draft and rejected reports", () => {
    expect(canEditReportContent({ status: "DRAFT" })).toBe(true);
    expect(canEditReportContent({ status: "REJECTED" })).toBe(true);
    expect(canEditReportContent({ status: "SUBMITTED" })).toBe(false);
    expect(canEditReportContent({ status: "APPROVED" })).toBe(false);
  });
});
