import { canVolunteer } from "@/features/access-control/lib/rules";
import type { Profile, SessionUser } from "@/features/access-control/types";
import type { VolunteerProfileDetails } from "@/features/volunteers/types";

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

export function toPublicVolunteerProfileDetails(
  details: VolunteerProfileDetails | null,
): VolunteerProfileDetails | null {
  if (!details) {
    return null;
  }

  return {
    $id: details.$id,
    batchYear: "",
    bio: details.bio,
    createdAt: details.createdAt,
    department: "",
    faculty: "",
    headline: details.headline,
    ieeeMembership: "",
    linkedinUrl: details.linkedinUrl,
    skills: details.skills,
    updatedAt: details.updatedAt,
    universityIndex: "",
    userId: details.userId,
  };
}
