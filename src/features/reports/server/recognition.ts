import {
  MOCK_EVENTS,
  MOCK_HALL_OF_FAME,
  MOCK_VOLUNTEER_OF_THE_MONTH,
} from "@/features/reports/lib/mock-data";
import { listConclusionReports } from "@/features/reports/lib/mock-repository";
import type { EventSummary } from "@/features/reports/types";

export function listEventSummaries(): EventSummary[] {
  const reports = listConclusionReports();

  return MOCK_EVENTS.map((event) => {
    const report = reports.find((entry) => entry.eventId === event.eventId);

    return {
      ...event,
      reportId: report?.$id,
      reportStatus: report?.status,
      volunteerCount: event.eventId === "MoraForesight 4.0" ? 24 : 18,
    };
  });
}

export function getVolunteerOfTheMonth() {
  return MOCK_VOLUNTEER_OF_THE_MONTH;
}

export function getHallOfFame() {
  return [...MOCK_HALL_OF_FAME];
}
