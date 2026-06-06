import PDFDocument from "pdfkit";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";
import { pdfFonts, pdfLayout, pdfTheme } from "@/pdf/theme";

type PdfDocument = InstanceType<typeof PDFDocument>;

export function createPdfDocument(title: string) {
  const doc = new PDFDocument({
    margin: pdfLayout.margin,
    size: "A4",
    info: {
      Author: ORGANIZATION_NAME,
      Creator: APP_NAME,
      Title: title,
    },
  });

  return doc;
}

export function renderDocumentHeader(doc: PdfDocument, title: string, subtitle?: string) {
  doc
    .fillColor(pdfTheme.primary)
    .fontSize(pdfFonts.caption)
    .text(ORGANIZATION_NAME.toUpperCase(), { continued: false });

  doc.moveDown(0.4);
  doc.fontSize(pdfFonts.title).fillColor(pdfTheme.text).text(title);

  if (subtitle) {
    doc.moveDown(0.3);
    doc.fontSize(pdfFonts.body).fillColor(pdfTheme.secondary).text(subtitle);
  }

  doc.moveDown(0.8);
  doc
    .strokeColor(pdfTheme.border)
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();

  doc.moveDown(1);
}

export function renderSection(doc: PdfDocument, heading: string, body: string) {
  doc.fontSize(pdfFonts.section).fillColor(pdfTheme.primary).text(heading);
  doc.moveDown(0.3);
  doc
    .fontSize(pdfFonts.body)
    .fillColor(pdfTheme.text)
    .text(body || "Not provided.", {
      align: "left",
      lineGap: pdfLayout.lineGap,
    });
  doc.moveDown(pdfLayout.sectionGap / pdfFonts.body);
}

export function renderKeyValueTable(
  doc: PdfDocument,
  rows: Array<{ label: string; value: string }>,
) {
  const startX = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = tableWidth * 0.32;
  const rowHeight = 24;
  let y = doc.y;

  for (const row of rows) {
    doc
      .rect(startX, y, tableWidth, rowHeight)
      .fillAndStroke(pdfTheme.surface, pdfTheme.border);

    doc
      .fillColor(pdfTheme.secondary)
      .fontSize(pdfFonts.body)
      .text(row.label, startX + 10, y + 7, { width: labelWidth - 12 });

    doc
      .fillColor(pdfTheme.text)
      .text(row.value, startX + labelWidth + 10, y + 7, {
        width: tableWidth - labelWidth - 20,
      });

    y += rowHeight;
  }

  doc.y = y + pdfLayout.sectionGap;
}

export function finalizePdf(doc: PdfDocument) {
  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
