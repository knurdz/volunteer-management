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
      value: formatDisplayDate(input.submittedAt) ?? "Not recorded",
    },
    {
      label: "Approved on",
      value: formatDisplayDate(input.approvedAt) ?? "Pending approval",
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
    filename: buildFilename("conclusion", input.eventId, input.eventTitle),
  };
}

function formatDisplayDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toLocaleDateString();
}

function buildFilename(prefix: string, identifier: string, fallbackLabel: string) {
  const sanitized = sanitizeFilename(identifier);

  if (sanitized) {
    return `${prefix}-${sanitized}.pdf`;
  }

  const fallback = sanitizeFilename(fallbackLabel);
  return fallback ? `${prefix}-${fallback}.pdf` : `${prefix}-report.pdf`;
}

function sanitizeFilename(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return ascii;
}
