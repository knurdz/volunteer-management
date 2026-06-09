import { describe, expect, it } from "vitest";
import { canAccessConclusionsTab, hasAnyEventLeadRole } from "@/features/reports/lib/access";
import type { SessionUser } from "@/features/access-control/types";

function createUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    authUser: {
      email: "user@example.com",
      id: "user-1",
      name: "Test User",
    },
    eventRoles: [],
    isAdmin: false,
    profile: {
      $id: "profile-1",
      authUserId: "user-1",
      googleEmail: "user@example.com",
      status: "ACTIVE",
      uomEmail: "user@uom.lk",
      uomVerified: true,
    },
    sbRoles: [],
    ...overrides,
  };
}

describe("reports access", () => {
  it("grants conclusions access to admins", () => {
    expect(canAccessConclusionsTab(createUser({ isAdmin: true }))).toBe(true);
  });

  it("grants conclusions access to chair and vice chair users", () => {
    expect(
      hasAnyEventLeadRole({
        eventRoles: [
          {
            $id: "assignment-1",
            active: true,
            assignedAt: "2026-01-01T00:00:00.000Z",
            assignedBy: "admin-1",
            eventChairCount: 1,
            eventId: "event-1",
            eventTitle: "IEEE Day",
            role: "Chair",
            userId: "user-1",
          },
        ],
      }),
    ).toBe(true);

    expect(
      canAccessConclusionsTab(
        createUser({
          eventRoles: [
            {
              $id: "assignment-2",
              active: true,
              assignedAt: "2026-01-01T00:00:00.000Z",
              assignedBy: "admin-1",
              eventChairCount: 1,
              eventId: "event-2",
              eventTitle: "Workshop",
              role: "Vice Chair",
              userId: "user-1",
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("denies conclusions access to non-chair users", () => {
    expect(
      canAccessConclusionsTab(
        createUser({
          eventRoles: [
            {
              $id: "assignment-3",
              active: true,
              assignedAt: "2026-01-01T00:00:00.000Z",
              assignedBy: "admin-1",
              eventChairCount: 1,
              eventId: "event-3",
              eventTitle: "Workshop",
              role: "Committee Member",
              userId: "user-1",
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});
