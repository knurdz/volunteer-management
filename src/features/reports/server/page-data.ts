import { MOCK_EVENTS } from "@/features/reports/lib/mock-data";
import { listConclusionReports } from "@/features/reports/server/conclusion-service";
import {
  getHallOfFame,
  getVolunteerOfTheMonth,
  listEventSummaries,
} from "@/features/reports/server/recognition";
import { listVolunteerProfiles } from "@/features/reports/server/volunteer-profile";

export function getReportsPageData() {
  return {
    events: MOCK_EVENTS,
    hallOfFame: getHallOfFame(),
    reports: listConclusionReports(),
    summaries: listEventSummaries(),
    volunteerOfTheMonth: getVolunteerOfTheMonth(),
    volunteers: listVolunteerProfiles(),
  };
}
