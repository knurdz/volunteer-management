import { describe, expect, it } from "vitest";
import {
  getEventPermissions,
  isEventVisibleToUser,
} from "@/features/events/lib/event-permissions";
import {
  assertLegalEventStatusTransition,
  isLegalEventStatusTransition,
} from "@/features/events/lib/event-status-transitions";
import type { Event, EventStatus } from "@/features/events/types";

function createEventFixture(overrides: Partial<Event> = {}): Event {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $id: "event-1",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    conclusion_status: "not_submitted",
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "admin-user",
    reference: "MF-4",
    start_date: "2026-06-01T00:00:00.000Z",
    status: "draft",
    term: "Summer",
    title: "MoraForesight 4.0",
    updated_at: "2026-01-01T00:00:00.000Z",
    year: 2026,
    ...overrides,
  };
}

describe("updateEventStatus transitions", () => {
  const legalForwardTransitions: Array<[EventStatus, EventStatus]> = [
    ["draft", "planning"],
    ["planning", "published"],
    ["published", "ongoing"],
    ["ongoing", "pending_conclusion"],
    ["pending_conclusion", "closed"],
  ];

  it("allows all legal forward transitions", () => {
    for (const [current, next] of legalForwardTransitions) {
      expect(isLegalEventStatusTransition(current, next)).toBe(true);
      expect(() => assertLegalEventStatusTransition(current, next)).not.toThrow();
    }
  });

  it("allows admin backward transitions", () => {
    expect(
      isLegalEventStatusTransition("published", "planning", { allowAdminBackward: true }),
    ).toBe(true);
    expect(
      isLegalEventStatusTransition("planning", "draft", { allowAdminBackward: true }),
    ).toBe(true);
  });

  it("rejects admin backward transitions without admin permission", () => {
    expect(isLegalEventStatusTransition("published", "planning")).toBe(false);
    expect(isLegalEventStatusTransition("planning", "draft")).toBe(false);
  });

  it("rejects illegal transitions", () => {
    const illegalTransitions: Array<[EventStatus, EventStatus]> = [
      ["draft", "published"],
      ["draft", "closed"],
      ["planning", "ongoing"],
      ["published", "closed"],
      ["ongoing", "closed"],
      ["closed", "draft"],
      ["closed", "ongoing"],
      ["pending_conclusion", "ongoing"],
      ["draft", "draft"],
    ];

    for (const [current, next] of illegalTransitions) {
      expect(isLegalEventStatusTransition(current, next)).toBe(false);
      expect(() => assertLegalEventStatusTransition(current, next)).toThrow(
        `Illegal event status transition from "${current}" to "${next}".`,
      );
    }
  });
});

describe("isEventVisibleToUser", () => {
  it("shows all events to admins", () => {
    const draftEvent = createEventFixture({ status: "draft" });

    expect(isEventVisibleToUser("user-1", "Admin", draftEvent)).toBe(true);
  });

  it("shows committee events regardless of status", () => {
    const draftEvent = createEventFixture({ status: "draft" });

    expect(isEventVisibleToUser("user-1", "", draftEvent, "chair")).toBe(true);
    expect(isEventVisibleToUser("user-1", "", draftEvent, "committee_member")).toBe(
      true,
    );
  });

  it("shows only published, ongoing, and closed events to other users", () => {
    const userId = "user-1";

    expect(
      isEventVisibleToUser(userId, "", createEventFixture({ status: "published" })),
    ).toBe(true);
    expect(
      isEventVisibleToUser(userId, "", createEventFixture({ status: "ongoing" })),
    ).toBe(true);
    expect(
      isEventVisibleToUser(userId, "", createEventFixture({ status: "closed" })),
    ).toBe(true);
    expect(
      isEventVisibleToUser(userId, "", createEventFixture({ status: "draft" })),
    ).toBe(false);
    expect(
      isEventVisibleToUser(userId, "", createEventFixture({ status: "planning" })),
    ).toBe(false);
    expect(
      isEventVisibleToUser(
        userId,
        "",
        createEventFixture({ status: "pending_conclusion" }),
      ),
    ).toBe(false);
  });
});

describe("getEventPermissions", () => {
  it("grants full permissions to admins", () => {
    const permissions = getEventPermissions(
      "admin-user",
      "Admin",
      createEventFixture({ status: "ongoing" }),
    );

    expect(permissions).toEqual({
      canApproveConclusion: true,
      canAssignRoles: true,
      canDelete: true,
      canEdit: true,
      canManageCommittee: true,
      canPublish: true,
      canSubmitConclusion: true,
    });
  });

  it("grants chair permissions based on event status", () => {
    const draftPermissions = getEventPermissions(
      "chair-user",
      "",
      createEventFixture({ status: "draft" }),
      "chair",
    );
    const ongoingPermissions = getEventPermissions(
      "chair-user",
      "",
      createEventFixture({ status: "ongoing" }),
      "chair",
    );

    expect(draftPermissions).toEqual({
      canApproveConclusion: false,
      canAssignRoles: true,
      canDelete: false,
      canEdit: true,
      canManageCommittee: true,
      canPublish: false,
      canSubmitConclusion: false,
    });
    expect(ongoingPermissions.canEdit).toBe(false);
    expect(ongoingPermissions.canSubmitConclusion).toBe(true);
  });

  it("grants view-only permissions to non-members", () => {
    const permissions = getEventPermissions(
      "user-1",
      "",
      createEventFixture({ status: "published" }),
    );

    expect(permissions).toEqual({
      canApproveConclusion: false,
      canAssignRoles: false,
      canDelete: false,
      canEdit: false,
      canManageCommittee: false,
      canPublish: false,
      canSubmitConclusion: false,
    });
  });
});
