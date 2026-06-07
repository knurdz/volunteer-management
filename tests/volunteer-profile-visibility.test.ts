import { describe, expect, it } from "vitest";
import {
  canShowVolunteerProfile,
  canViewPrivateVolunteerProfile,
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
});
