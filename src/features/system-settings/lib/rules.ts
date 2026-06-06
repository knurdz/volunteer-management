import { EVENT_ROLES, SB_ROLES } from "@/lib/config";
import type {
  IeeeTerm,
  IeeeTermStatus,
  PermissionOverview,
  TopBoardExclusion,
} from "@/features/system-settings/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type TermDateRange = {
  endDate: string;
  startDate: string;
};

export function isIsoDateOnly(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function assertValidTermDates({ endDate, startDate }: TermDateRange) {
  if (!isIsoDateOnly(startDate) || !isIsoDateOnly(endDate)) {
    throw new Error("Term dates must use YYYY-MM-DD format.");
  }

  if (startDate >= endDate) {
    throw new Error("Term end date must be after the start date.");
  }
}

export function formatTermLabel(startDate: string) {
  if (!isIsoDateOnly(startDate)) {
    throw new Error("Term start date must use YYYY-MM-DD format.");
  }

  const startYear = Number(startDate.slice(0, 4));
  const nextYearSuffix = String(startYear + 1).slice(-2);

  return `${startYear}/${nextYearSuffix}`;
}

export function getSuggestedTermRange(reference = new Date()) {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  const startYear = month >= 9 ? year : year - 1;

  return {
    endDate: `${startYear + 1}-09-30`,
    label: `${startYear}/${String(startYear + 1).slice(-2)}`,
    startDate: `${startYear}-10-01`,
  };
}

export function dateRangesOverlap(first: TermDateRange, second: TermDateRange) {
  assertValidTermDates(first);
  assertValidTermDates(second);

  return first.startDate <= second.endDate && second.startDate <= first.endDate;
}

export function assertNoOverlappingTerms(
  candidate: TermDateRange & { $id?: string; status?: IeeeTermStatus },
  terms: Array<Pick<IeeeTerm, "$id" | "endDate" | "startDate" | "status">>,
) {
  assertValidTermDates(candidate);

  const overlap = terms.find(
    (term) =>
      term.$id !== candidate.$id &&
      term.status !== "CLOSED" &&
      candidate.status !== "CLOSED" &&
      dateRangesOverlap(candidate, term),
  );

  if (overlap) {
    throw new Error(`Term dates overlap with ${overlap.$id}.`);
  }
}

export function isActiveTopBoardExclusion(
  exclusion: Pick<TopBoardExclusion, "active" | "revokedAt">,
) {
  return exclusion.active && !exclusion.revokedAt;
}

export function buildPermissionOverview(adminEmail: string): PermissionOverview {
  return {
    adminEmail,
    adminSource: "ADMIN_EMAIL",
    eventRoles: EVENT_ROLES.map((role) => ({
      notes:
        role === "Chair"
          ? "Event-level lead privilege. Multiple Chair assignments display as Co-chair."
          : "Event-scoped responsibility controlled by Admin assignment.",
      role,
      scope: "event",
    })),
    notes: [
      "Admin is determined only by ADMIN_EMAIL and is not assigned through the database.",
      "Student Branch roles are term or branch-level privileges.",
      "Event roles are scoped to a specific event and can differ per event.",
      "Server-side route guards must be used for protected actions.",
    ],
    sbRoles: SB_ROLES.map((role) => ({
      notes: "Student Branch privilege assigned and revoked by the Admin account.",
      role,
      scope: "student-branch",
    })),
  };
}
