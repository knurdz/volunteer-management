import type { PointLedgerEntry, TermScoringConfig } from "../types";

/**
 * Calculates the average grade of an array of grades.
 * Rounds to the nearest integer. Returns 0 if no grades.
 */
export function calculateAverageGrade(grades: number[]): number {
  if (grades.length === 0) return 0;
  const sum = grades.reduce((acc, grade) => acc + grade, 0);
  return Math.round(sum / grades.length);
}

/**
 * Checks if a volunteer is eligible for recognition on the Top Board.
 * Volunteers are ineligible if they have an active exclusion config for the term and year.
 */
export function isEligibleForTopBoard(
  userId: string,
  term: string,
  year: number,
  config: TermScoringConfig[]
): boolean {
  const userExclusions = config.filter(
    (c) =>
      c.userId === userId &&
      c.term === term &&
      c.year === year &&
      c.excludedFromTopBoard
  );
  return userExclusions.length === 0;
}

/**
 * Filters point ledger entries by conclusionApprovalDate within a target month (1-indexed) and year.
 */
export function filterLedgerByMonth(
  ledger: PointLedgerEntry[],
  month: number,
  year: number
): PointLedgerEntry[] {
  return ledger.filter((entry) => {
    const date = new Date(entry.conclusionApprovalDate);
    // Use UTC date logic for server/database standard consistency
    return date.getUTCFullYear() === year && (date.getUTCMonth() + 1) === month;
  });
}

/**
 * Filters point ledger entries by IEEE term year.
 */
export function filterLedgerByTerm(
  ledger: PointLedgerEntry[],
  term: string,
  year: number
): PointLedgerEntry[] {
  return ledger.filter((entry) => {
    const date = new Date(entry.conclusionApprovalDate);
    return date.getUTCFullYear() === year;
  });
}

/**
 * Reproduces total points from ledger data.
 */
export function sumPointsFromLedger(ledger: PointLedgerEntry[]): number {
  return ledger.reduce((sum, entry) => sum + entry.points, 0);
}

/**
 * Checks if a chair is trying to grade their own event participant.
 */
export function isSelfEventGrade(
  graderId: string,
  eventId: string,
  chairEventIds: string[]
): boolean {
  return chairEventIds.includes(eventId);
}
