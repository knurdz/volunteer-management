import { canVolunteer } from "@/features/access-control/lib/rules";
import type { Profile, SessionUser } from "@/features/access-control/types";

export function canShowVolunteerProfile(profile: Pick<Profile, "status" | "uomVerified">) {
  return canVolunteer(profile);
}

export function canViewPrivateVolunteerProfile({
  profileUserId,
  viewer,
}: {
  profileUserId: string;
  viewer?: Pick<SessionUser, "authUser" | "isAdmin"> | null;
}) {
  return Boolean(viewer && (viewer.isAdmin || viewer.authUser.id === profileUserId));
}
