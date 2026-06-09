import { describe, expect, it } from "vitest";
import {
  canShowVolunteerProfile,
  canViewPrivateVolunteerProfile,
  toPublicVolunteerProfileDetails,
} from "../src/features/volunteers/lib/profile-visibility";

describe("volunteer profile visibility", () => {
  it("only exposes active UoM verified volunteer profiles", () => {
    expect(canShowVolunteerProfile({ status: "ACTIVE", uomVerified: true })).toBe(true);
    expect(canShowVolunteerProfile({ status: "ACTIVE", uomVerified: false })).toBe(false);
    expect(canShowVolunteerProfile({ status: "DISABLED", uomVerified: true })).toBe(false);
  });

  it("only shows private profile data to self or admin", () => {
    expect(
      canViewPrivateVolunteerProfile({
        profileUserId: "user-1",
        viewer: {
          authUser: { email: "user@example.com", id: "user-1", name: "User" },
          isAdmin: false,
        },
      }),
    ).toBe(true);
    expect(
      canViewPrivateVolunteerProfile({
        profileUserId: "user-1",
        viewer: {
          authUser: { email: "admin@example.com", id: "admin", name: "Admin" },
          isAdmin: true,
        },
      }),
    ).toBe(true);
    expect(
      canViewPrivateVolunteerProfile({
        profileUserId: "user-1",
        viewer: {
          authUser: { email: "other@example.com", id: "user-2", name: "Other" },
          isAdmin: false,
        },
      }),
    ).toBe(false);
    expect(
      canViewPrivateVolunteerProfile({
        profileUserId: "user-1",
        viewer: null,
      }),
    ).toBe(false);
  });

  it("only exposes recommendations when private profile access is allowed", () => {
    expect(
      canViewPrivateVolunteerProfile({
        profileUserId: "user-1",
        viewer: null,
      }),
    ).toBe(false);
    expect(
      canViewPrivateVolunteerProfile({
        profileUserId: "user-1",
        viewer: {
          authUser: { email: "other@example.com", id: "user-2", name: "Other" },
          isAdmin: false,
        },
      }),
    ).toBe(false);
    expect(
      canViewPrivateVolunteerProfile({
        profileUserId: "user-1",
        viewer: {
          authUser: { email: "user@example.com", id: "user-1", name: "User" },
          isAdmin: false,
        },
      }),
    ).toBe(true);
  });

  it("removes academic identifiers from public profile details", () => {
    const result = toPublicVolunteerProfileDetails({
      $id: "details-1",
      batchYear: "2024",
      bio: "Volunteer bio",
      createdAt: "2026-01-01T00:00:00.000Z",
      department: "Computer Science",
      faculty: "Engineering",
      headline: "Volunteer",
      ieeeMembership: "Student Member",
      linkedinUrl: "https://www.linkedin.com/in/test",
      skills: "Leadership",
      universityIndex: "220000A",
      updatedAt: "2026-01-01T00:00:00.000Z",
      userId: "user-1",
    });

    expect(result).toMatchObject({
      batchYear: "",
      bio: "Volunteer bio",
      department: "",
      faculty: "",
      headline: "Volunteer",
      ieeeMembership: "",
      linkedinUrl: "https://www.linkedin.com/in/test",
      skills: "Leadership",
      universityIndex: "",
    });
  });
});
