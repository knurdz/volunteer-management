import { normalizeCommitteeName } from "@/features/access-control/lib/rules";
import {
  EVENT_YEAR_MAX,
  EVENT_YEAR_MIN,
  IEEE_TERMS,
} from "@/lib/config";
import type { Committee, Event, UpdateEventInput } from "@/features/events/types";
import { ValidationError } from "@/server/errors";

export function assertIeeeTerm(term: string) {
  if (!IEEE_TERMS.includes(term as (typeof IEEE_TERMS)[number])) {
    throw new ValidationError(
      `term must be one of the configured IEEE terms: ${IEEE_TERMS.join(", ")}`,
    );
  }
}

export function assertEventYear(year: number) {
  if (!Number.isInteger(year) || year < EVENT_YEAR_MIN || year > EVENT_YEAR_MAX) {
    throw new ValidationError(
      `year must be an integer between ${EVENT_YEAR_MIN} and ${EVENT_YEAR_MAX}`,
    );
  }
}

export function assertEventDateRange({
  end_date,
  start_date,
}: {
  end_date?: string | null;
  start_date: string;
}) {
  if (end_date && new Date(end_date) <= new Date(start_date)) {
    throw new ValidationError("end_date must be after start_date");
  }
}

export function assertMergedEventDateRange(existing: Event, input: UpdateEventInput) {
  const startDate = input.start_date ?? existing.start_date;
  const endDate = input.end_date !== undefined ? input.end_date : existing.end_date;

  assertEventDateRange({
    end_date: endDate,
    start_date: startDate,
  });
}

export function resolveCommitteeByName(
  committees: Committee[],
  committeeName?: string,
) {
  const normalized = normalizeCommitteeName(committeeName);

  if (!normalized) {
    return null;
  }

  return (
    committees.find(
      (committee) => normalizeCommitteeName(committee.name)?.toLowerCase() === normalized.toLowerCase(),
    ) ?? null
  );
}

export function assertCommitteeExistsForRole({
  committees,
  committeeName,
  role,
}: {
  committees: Committee[];
  committeeName?: string;
  role: string;
}) {
  if (role !== "Committee Lead" && role !== "Committee Member") {
    return;
  }

  const committee = resolveCommitteeByName(committees, committeeName);

  if (!committee) {
    throw new ValidationError(
      "committee_name must match an existing committee for this event.",
    );
  }
}
