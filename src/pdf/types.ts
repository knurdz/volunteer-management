import type { ConclusionReportContent } from "@/features/reports/types";

export type ConclusionReportPdfInput = {
  eventId: string;
  eventTitle: string;
  approvedAt?: string;
  submittedByName: string;
  submittedAt?: string;
  content: ConclusionReportContent;
};

export type VolunteerProfilePdfInput = {
  name: string;
  googleEmail: string;
  uomEmail?: string;
  sbRoles: string[];
  participations: Array<{
    eventTitle: string;
    role: string;
    committeeName?: string;
    assignedAt: string;
  }>;
  recommendations: Array<{
    fromName: string;
    eventTitle: string;
    note: string;
  }>;
  pointsLedger?: {
    total: number;
    entries: Array<{
      eventTitle: string;
      role: string;
      points: number;
      awardedAt: string;
    }>;
  };
};

export type PdfBuildResult = {
  buffer: Buffer;
  filename: string;
};

export type PdfBuildError = {
  code: "MISSING_DATA" | "NOT_EXPORTABLE";
  message: string;
};
