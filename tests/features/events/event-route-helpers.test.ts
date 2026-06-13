import { describe, expect, it } from "vitest";
import { canViewEventCommittees } from "@/features/events/lib/committee-permissions";
import { isEventVisibleToUser } from "@/features/events/lib/event-permissions";
import {
  canChangeEventStatus,
  canCreateEvent,
} from "@/features/events/server/event-route-helpers";
import type { Event } from "@/features/events/types";

function createEventFixture(overrides: Partial<Event> = {}): Event {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $id: "event-1",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    conclusion_status: "approved",
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "creator-user",
    reference: "MF-4",
    start_date: "2026-06-01T00:00:00.000Z",
    status: "closed",
    term: "2025/2026",
    title: "Closed Event",
    updated_at: "2026-01-01T00:00:00.000Z",
    year: 2026,
    ...overrides,
  };
}

describe("event route helpers and permissions", () => {
  it("requires verified active profile for non-admin event creation", () => {
    expect(
      canCreateEvent({
        authUser: { email: "excom@example.com", id: "user-1", name: "ExCom" },
        eventRoles: [],
        isAdmin: false,
        profile: {
          $id: "profile-1",
          authUserId: "user-1",
          googleEmail: "excom@example.com",
          status: "ACTIVE",
          uomVerified: false,
        },
        sbRoles: ["ExCom"],
      }),
    ).toBe(false);
  });

  it("hides closed events from users without roles", () => {
    const closedEvent = createEventFixture();

    expect(isEventVisibleToUser("user-1", false, closedEvent)).toBe(false);
    expect(canViewEventCommittees("user-1", false, closedEvent, null)).toBe(false);
  });

  it("allows admins to bypass conclusion-managed status changes only through helpers", () => {
    const event = createEventFixture({ status: "ongoing" });

    expect(
      canChangeEventStatus({
        event,
        newStatus: "pending_conclusion",
        user: {
          authUser: { email: "admin@example.com", id: "admin-1", name: "Admin" },
          eventRoles: [],
          isAdmin: true,
          profile: {
            $id: "profile-admin",
            authUserId: "admin-1",
            googleEmail: "admin@example.com",
            status: "ACTIVE",
            uomVerified: false,
          },
          sbRoles: [],
        },
      }),
    ).toBe(false);
  });
});
