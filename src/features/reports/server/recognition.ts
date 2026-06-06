import "server-only";

import { listActiveEventRoleAssignments } from "@/features/access-control/server/roles";
import { normalizeEventReference } from "@/features/access-control/lib/rules";
import { listConclusionReports } from "@/features/reports/server/conclusion-service";
import type { EventSummary, HallOfFameEntry, VolunteerOfTheMonth } from "@/features/reports/types";

export async function listEventSummaries(): Promise<EventSummary[]> {
  const [assignments, reports] = await Promise.all([
    listActiveEventRoleAssignments(),
    listConclusionReports(),
  ]);

  const events = new Map<
    string,
    {
      eventId: string;
      eventTitle: string;
      heldOn: string;
      volunteerUserIds: Set<string>;
    }
  >();

  for (const assignment of assignments) {
    const eventId = normalizeEventReference(assignment.eventId);
    const existing = events.get(eventId) ?? {
      eventId,
      eventTitle: assignment.eventTitle,
      heldOn: assignment.assignedAt,
      volunteerUserIds: new Set<string>(),
    };

    existing.volunteerUserIds.add(assignment.userId);
    events.set(eventId, existing);
  }

  return [...events.values()]
    .map((event) => {
      const report = reports.find(
        (entry) => normalizeEventReference(entry.eventId) === event.eventId,
      );

      return {
        eventId: event.eventId,
        eventTitle: event.eventTitle,
        heldOn: event.heldOn,
        reportId: report?.$id,
        reportStatus: report?.status,
        status: report?.status === "APPROVED" ? "CLOSED" : "PENDING_CONCLUSION",
        summary: report
          ? `Conclusion report is ${report.status.toLowerCase()}.`
          : "No conclusion report submitted yet.",
        volunteerCount: event.volunteerUserIds.size,
      } satisfies EventSummary;
    })
    .sort(
      (left, right) => new Date(right.heldOn).getTime() - new Date(left.heldOn).getTime(),
    );
}

export function getVolunteerOfTheMonth(): VolunteerOfTheMonth | null {
  return null;
}

export function getHallOfFame(): HallOfFameEntry[] {
  return [];
}
