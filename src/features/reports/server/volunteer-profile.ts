import { MOCK_VOLUNTEER_PROFILES } from "@/features/reports/lib/mock-data";
import type { VolunteerProfileExport } from "@/features/reports/types";

export function listVolunteerProfiles() {
  return [...MOCK_VOLUNTEER_PROFILES];
}

export function getVolunteerProfile(userId: string): VolunteerProfileExport | null {
  return (
    MOCK_VOLUNTEER_PROFILES.find((profile) => profile.userId === userId) ?? null
  );
}

export function assertVolunteerProfileExportable(userId: string) {
  const profile = getVolunteerProfile(userId);

  if (!profile) {
    throw new Error("Volunteer profile was not found.");
  }

  return profile;
}
