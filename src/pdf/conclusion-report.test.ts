import { describe, expect, it } from "vitest";
import { buildConclusionReportPdf } from "@/pdf/conclusion-report";

describe("conclusion report pdf", () => {
  it("builds a non-empty pdf buffer", async () => {
    const result = await buildConclusionReportPdf({
      approvedAt: "2025-10-14T00:00:00.000Z",
      content: {
        attendanceNotes: "Peak attendance during membership drive",
        challenges: "Rain required moving one booth indoors",
        objectives: "Celebrate IEEE Day with outreach activities",
        outcomes: "Hosted three outreach booths and welcomed 180 attendees",
        recommendations: "Reserve indoor backup space earlier",
      },
      eventId: "IEEE Day 2025",
      eventTitle: "IEEE Day 2025",
      submittedAt: "2025-10-12T00:00:00.000Z",
      submittedByName: "Amelia Perera",
    });

    expect(result.filename).toBe("conclusion-ieee-day-2025.pdf");
    expect(result.buffer.byteLength).toBeGreaterThan(500);
    expect(result.buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
