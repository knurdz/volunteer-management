import "server-only";

import type { SessionUser } from "@/features/access-control/types";
import { hasEventRole, normalizeEventReference } from "@/features/access-control/lib/rules";
import {
  listConclusionReportsForUser,
  listConclusionReports,
} from "@/features/reports/server/conclusion-service";
import {
  getHallOfFame,
  getVolunteerOfTheMonth,
  listEventSummaries,
} from "@/features/reports/server/recognition";
import { listVolunteerProfiles } from "@/features/reports/server/volunteer-profile";
import type { MockEvent } from "@/features/reports/types";

const EVENT_LEAD_ROLES = ["Chair", "Vice Chair"] as const;

async function listPendingConclusionEvents(user: SessionUser): Promise<MockEvent[]> {
  const summaries = await listEventSummaries();

  return summaries
    .filter((summary) => summary.status === "PENDING_CONCLUSION")
    .filter(
      (summary) =>
        user.isAdmin || hasEventRole(user, summary.eventId, [...EVENT_LEAD_ROLES]),
    )
    .map((summary) => ({
      eventId: normalizeEventReference(summary.eventId),
      eventTitle: summary.eventTitle,
      heldOn: summary.heldOn,
      status: summary.status,
      summary: summary.summary,
    }));
}

export async function getReportsPageData(user: SessionUser) {
  const [events, reports, summaries, volunteers] = await Promise.all([
    listPendingConclusionEvents(user),
    user.isAdmin ? listConclusionReports() : listConclusionReportsForUser(user),
    listEventSummaries(),
    listVolunteerProfiles(),
  ]);

  return {
    events,
    hallOfFame: getHallOfFame(),
    reports,
    summaries,
    volunteerOfTheMonth: getVolunteerOfTheMonth(),
    volunteers,
  };
}
