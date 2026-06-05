export type ParticipationStatus = "attended" | "absent" | "excused";

export interface ParticipationRecord {
  $id: string;
  userId: string;
  eventId: string;
  role: string;
  status: ParticipationStatus;
  createdAt: string;
  updatedAt: string;
}

export type GradingStatus = "pending" | "submitted" | "reviewed" | "finalized";

export interface GradeRequest {
  $id: string;
  requestId: string;
  eventId: string;
  requestedBy: string;
  targetUserId: string;
  status: GradingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GradeReview {
  $id: string;
  gradeRequestId: string;
  reviewerId: string;
  gradeValue: number;
  submittedAt: string;
  audit_metadata?: string;
}

export interface GradeAuditEntry {
  originalValue: number;
  newValue: number;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

export type PointLedgerSource = "grade" | "role" | "manual";

export interface PointLedgerEntry {
  $id: string;
  userId: string;
  eventId: string;
  points: number;
  conclusionApprovalDate: string;
  source: PointLedgerSource;
  createdBy: string;
  createdAt: string;
}

export interface TermScoringConfig {
  $id: string;
  userId: string;
  term: string;
  year: number;
  excludedFromTopBoard: boolean;
  reason?: string;
  setBy: string;
}
