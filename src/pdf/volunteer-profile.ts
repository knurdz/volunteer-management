import { pdfFonts, pdfTheme } from "@/pdf/theme";
import {
  createPdfDocument,
  finalizePdf,
  renderDocumentHeader,
  renderKeyValueTable,
  renderSection,
} from "@/pdf/layout";
import type { PdfBuildResult, VolunteerProfilePdfInput } from "@/pdf/types";

export async function buildVolunteerProfilePdf(
  input: VolunteerProfilePdfInput,
): Promise<PdfBuildResult> {
  const doc = createPdfDocument(`Volunteer Profile - ${input.name}`);

  renderDocumentHeader(doc, "Volunteer Profile", input.name);

  renderKeyValueTable(doc, [
    { label: "Google email", value: input.googleEmail },
    { label: "UoM email", value: input.uomEmail ?? "Not verified" },
    {
      label: "SB roles",
      value: input.sbRoles.length > 0 ? input.sbRoles.join(", ") : "None assigned",
    },
  ]);

  renderParticipationSection(doc, input);
  renderRecommendationsSection(doc, input);
  renderPointsSection(doc, input);

  const buffer = await finalizePdf(doc);

  return {
    buffer,
    filename: `volunteer-${sanitizeFilename(input.name)}.pdf`,
  };
}

function renderParticipationSection(
  doc: ReturnType<typeof createPdfDocument>,
  input: VolunteerProfilePdfInput,
) {
  doc.fontSize(pdfFonts.section).fillColor(pdfTheme.primary).text("Participation");
  doc.moveDown(0.4);

  if (input.participations.length === 0) {
    doc.fontSize(pdfFonts.body).fillColor(pdfTheme.secondary).text("No event participation recorded.");
    doc.moveDown(1);
    return;
  }

  for (const participation of input.participations) {
    doc
      .fontSize(pdfFonts.body)
      .fillColor(pdfTheme.text)
      .text(
        `${participation.eventTitle} — ${participation.role}${
          participation.committeeName ? ` (${participation.committeeName})` : ""
        }`,
      );
    doc
      .fontSize(pdfFonts.caption)
      .fillColor(pdfTheme.muted)
      .text(`Assigned ${new Date(participation.assignedAt).toLocaleDateString()}`);
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);
}

function renderRecommendationsSection(
  doc: ReturnType<typeof createPdfDocument>,
  input: VolunteerProfilePdfInput,
) {
  if (input.recommendations.length === 0) {
    renderSection(doc, "Recommendations", "No recommendations recorded.");
    return;
  }

  doc.fontSize(pdfFonts.section).fillColor(pdfTheme.primary).text("Recommendations");
  doc.moveDown(0.4);

  for (const recommendation of input.recommendations) {
    doc
      .fontSize(pdfFonts.body)
      .fillColor(pdfTheme.text)
      .text(`${recommendation.fromName} — ${recommendation.eventTitle}`);
    doc
      .fontSize(pdfFonts.body)
      .fillColor(pdfTheme.secondary)
      .text(recommendation.note, { lineGap: 4 });
    doc.moveDown(0.6);
  }

  doc.moveDown(0.4);
}

function renderPointsSection(
  doc: ReturnType<typeof createPdfDocument>,
  input: VolunteerProfilePdfInput,
) {
  doc.fontSize(pdfFonts.section).fillColor(pdfTheme.primary).text("Points Summary");
  doc.moveDown(0.4);

  if (!input.pointsLedger) {
    doc
      .fontSize(pdfFonts.body)
      .fillColor(pdfTheme.secondary)
      .text(
        "Thesaru ledger data is not available yet. Points will appear here once the ledger is connected.",
      );
    return;
  }

  doc
    .fontSize(pdfFonts.body)
    .fillColor(pdfTheme.text)
    .text(`Lifetime total: ${input.pointsLedger.total} points`);
  doc.moveDown(0.6);

  for (const entry of input.pointsLedger.entries) {
    doc
      .fontSize(pdfFonts.body)
      .fillColor(pdfTheme.text)
      .text(`${entry.eventTitle} — ${entry.role}: ${entry.points} points`);
    doc
      .fontSize(pdfFonts.caption)
      .fillColor(pdfTheme.muted)
      .text(`Awarded ${new Date(entry.awardedAt).toLocaleDateString()}`);
    doc.moveDown(0.4);
  }
}

function sanitizeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
