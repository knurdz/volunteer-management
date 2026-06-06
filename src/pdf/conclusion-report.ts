import {
  createPdfDocument,
  finalizePdf,
  renderDocumentHeader,
  renderKeyValueTable,
  renderSection,
} from "@/pdf/layout";
import type { ConclusionReportPdfInput, PdfBuildResult } from "@/pdf/types";

export async function buildConclusionReportPdf(
  input: ConclusionReportPdfInput,
): Promise<PdfBuildResult> {
  const doc = createPdfDocument(`Conclusion Report - ${input.eventTitle}`);

  renderDocumentHeader(
    doc,
    "Event Conclusion Report",
    `${input.eventTitle} (${input.eventId})`,
  );

  renderKeyValueTable(doc, [
    { label: "Submitted by", value: input.submittedByName },
    {
      label: "Submitted on",
      value: input.submittedAt
        ? new Date(input.submittedAt).toLocaleDateString()
        : "Not recorded",
    },
    {
      label: "Approved on",
      value: input.approvedAt
        ? new Date(input.approvedAt).toLocaleDateString()
        : "Pending approval",
    },
  ]);

  renderSection(doc, "Objectives", input.content.objectives);
  renderSection(doc, "Outcomes", input.content.outcomes);
  renderSection(doc, "Challenges", input.content.challenges);
  renderSection(doc, "Recommendations", input.content.recommendations);
  renderSection(doc, "Attendance Notes", input.content.attendanceNotes);

  const buffer = await finalizePdf(doc);

  return {
    buffer,
    filename: `conclusion-${sanitizeFilename(input.eventId)}.pdf`,
  };
}

function sanitizeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
