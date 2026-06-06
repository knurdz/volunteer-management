import type { EVENT_STATUSES } from "@/lib/config";
import type { EventRole, SbRole } from "@/features/access-control/types";

export type EventStatus = (typeof EVENT_STATUSES)[number];

export type ReportStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export type ConclusionReportContent = {
  objectives: string;
  outcomes: string;
  challenges: string;
  recommendations: string;
  attendanceNotes: string;
};

export type ConclusionReport = {
  $id: string;
  eventId: string;
  eventTitle: string;
  status: ReportStatus;
  content: ConclusionReportContent;
  submittedBy: string;
  submittedByName: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReportApproval = {
  $id: string;
  reportId: string;
  status: "APPROVED" | "REJECTED";
  reviewedBy: string;
  reviewedByName: string;
  reviewNote?: string;
  reviewedAt: string;
};

export type MockEvent = {
  eventId: string;
  eventTitle: string;
  status: EventStatus;
  heldOn: string;
  summary: string;
};

export type EventSummary = MockEvent & {
  reportId?: string;
  reportStatus?: ReportStatus;
  volunteerCount: number;
};

export type PointsLedgerEntry = {
  $id: string;
  eventId: string;
  eventTitle: string;
  role: EventRole;
  points: number;
  awardedAt: string;
};

export type PointsLedger = {
  total: number;
  entries: PointsLedgerEntry[];
};

export type VolunteerParticipation = {
  eventId: string;
  eventTitle: string;
  role: EventRole;
  committeeName?: string;
  assignedAt: string;
};

export type VolunteerRecommendation = {
  $id: string;
  fromName: string;
  eventTitle: string;
  note: string;
  createdAt: string;
};

export type VolunteerProfileExport = {
  userId: string;
  name: string;
  googleEmail: string;
  uomEmail?: string;
  sbRoles: SbRole[];
  participations: VolunteerParticipation[];
  recommendations: VolunteerRecommendation[];
  pointsLedger?: PointsLedger;
};

export type VolunteerOfTheMonth = {
  month: string;
  year: number;
  userId: string;
  name: string;
  pointsEarned: number;
  highlight: string;
};

export type IeeeTerm = {
  label: string;
  startYear: number;
  endYear: number;
};

export type HallOfFameEntry = {
  rank: number;
  userId: string;
  name: string;
  pointsEarned: number;
  term: IeeeTerm;
};
