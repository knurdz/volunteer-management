import { beforeEach, describe, expect, it } from "vitest";
import {
  assertConclusionReportExportable,
  createConclusionReport,
  resetMockRepository,
  reviewConclusionReport,
  updateConclusionReport,
} from "@/features/reports/lib/mock-repository";

describe("mock conclusion repository", () => {
  beforeEach(() => {
    resetMockRepository();
  });

  it("requires approval before export", () => {
    const report = createConclusionReport({
      content: {
        attendanceNotes: "Peak at evening drive",
        challenges: "Rain moved one booth indoors",
        objectives: "Celebrate IEEE Day",
        outcomes: "180 attendees across sessions",
        recommendations: "Reserve indoor backup space",
      },
      eventId: "New Event",
      eventTitle: "New Event",
      submittedBy: "user-1",
      submittedByName: "Test User",
    });

    const submitted = updateConclusionReport(report.$id, { status: "SUBMITTED" });

    expect(() => assertConclusionReportExportable(submitted.$id)).toThrow(
      "only after approval",
    );

    reviewConclusionReport(submitted.$id, {
      reviewedBy: "admin",
      reviewedByName: "Admin",
      status: "APPROVED",
    });

    expect(assertConclusionReportExportable(submitted.$id).status).toBe("APPROVED");
  });
});
