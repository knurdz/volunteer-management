import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEventPermissions,
  isEventVisibleToUser,
} from "@/features/events/lib/event-permissions";
import {
  assertLegalEventStatusTransition,
  isLegalEventStatusTransition,
} from "@/features/events/lib/event-status-transitions";
import type { Event, EventStatus } from "@/features/events/types";

const mockTables = {
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: () => ({
    tables: mockTables,
    users: { get: vi.fn() },
  }),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: "test-db",
  }),
}));

vi.mock("@/features/access-control/server/roles", () => ({
  assignEventRole: vi.fn(),
  getActiveEventRoleAssignments: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/events/server/event-audit", () => ({
  safeEventAuditLog: vi.fn(),
}));

vi.mock("@/features/events/server/committees.server", () => ({
  createCommittee: vi.fn().mockResolvedValue({
    $id: "committee-general",
    name: "General",
  }),
  deleteCommittee: vi.fn(),
  listCommitteesForEvent: vi.fn().mockResolvedValue([]),
}));

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
    term: "2025/2026",
    title: "MoraForesight 4.0",
    updated_at: "2026-01-01T00:00:00.000Z",
    year: 2026,
    ...overrides,
  };
}

function toEventRow(event: Event) {
  return {
    $createdAt: event.$createdAt,
    $id: event.$id,
    $updatedAt: event.$updatedAt,
    conclusion_status: event.conclusion_status,
    created_at: event.created_at,
    created_by: event.created_by,
    description: event.description ?? "",
    end_date: event.end_date ?? null,
    reference: event.reference,
    start_date: event.start_date,
    status: event.status,
    term: event.term,
    title: event.title,
    updated_at: event.updated_at,
    year: event.year,
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

    expect(isEventVisibleToUser("user-1", true, draftEvent)).toBe(true);
  });

  it("shows committee events regardless of status", () => {
    const draftEvent = createEventFixture({ status: "draft" });

    expect(isEventVisibleToUser("user-1", false, draftEvent, "Chair")).toBe(true);
    expect(isEventVisibleToUser("user-1", false, draftEvent, "Committee Member")).toBe(
      true,
    );
  });

  it("shows draft events to their creator", () => {
    const draftEvent = createEventFixture({ created_by: "user-1", status: "draft" });

    expect(isEventVisibleToUser("user-1", false, draftEvent)).toBe(true);
    expect(isEventVisibleToUser("user-2", false, draftEvent)).toBe(false);
  });

  it("shows published, ongoing, and pending_conclusion events to other users", () => {
    const userId = "user-1";

    expect(
      isEventVisibleToUser(userId, false, createEventFixture({ status: "published" })),
    ).toBe(true);
    expect(
      isEventVisibleToUser(userId, false, createEventFixture({ status: "ongoing" })),
    ).toBe(true);
    expect(
      isEventVisibleToUser(
        userId,
        false,
        createEventFixture({ status: "pending_conclusion" }),
      ),
    ).toBe(true);
    expect(
      isEventVisibleToUser(userId, false, createEventFixture({ status: "draft" })),
    ).toBe(false);
    expect(
      isEventVisibleToUser(userId, false, createEventFixture({ status: "planning" })),
    ).toBe(false);
    expect(
      isEventVisibleToUser(userId, false, createEventFixture({ status: "closed" })),
    ).toBe(false);
  });
});

describe("getEventPermissions", () => {
  it("grants full permissions to admins", () => {
    const permissions = getEventPermissions(
      "admin-user",
      true,
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
      false,
      createEventFixture({ status: "draft" }),
      "Chair",
    );
    const ongoingPermissions = getEventPermissions(
      "chair-user",
      false,
      createEventFixture({ status: "ongoing" }),
      "Chair",
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
      false,
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

describe("event service operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submitConclusion sets both event.status and conclusion_status atomically", async () => {
    const { submitConclusion } = await import("@/features/events/server/event-service");
    const event = createEventFixture({ conclusion_status: "not_submitted", status: "ongoing" });

    mockTables.getRow.mockResolvedValueOnce(toEventRow(event));
    mockTables.updateRow.mockImplementation(async (_db, _table, _id, payload) =>
      toEventRow({ ...event, ...payload }),
    );

    const updated = await submitConclusion("event-1", "chair-user");

    expect(mockTables.updateRow).toHaveBeenCalledWith(
      "test-db",
      "events",
      "event-1",
      expect.objectContaining({
        conclusion_status: "submitted",
        status: "pending_conclusion",
      }),
    );
    expect(updated.status).toBe("pending_conclusion");
    expect(updated.conclusion_status).toBe("submitted");
  });

  it("rejectConclusion sets status back to ongoing and conclusion_status to rejected", async () => {
    const { rejectConclusion } = await import("@/features/events/server/event-service");
    const event = createEventFixture({
      conclusion_status: "submitted",
      status: "pending_conclusion",
    });

    mockTables.getRow.mockResolvedValueOnce(toEventRow(event));
    mockTables.updateRow.mockImplementation(async (_db, _table, _id, payload) =>
      toEventRow({ ...event, ...payload }),
    );

    const updated = await rejectConclusion("event-1", "admin-user");

    expect(updated.status).toBe("ongoing");
    expect(updated.conclusion_status).toBe("rejected");
  });

  it("createEvent auto-assigns creator as chair when creator is non-Admin", async () => {
    const { assignEventRole } = await import("@/features/access-control/server/roles");
    const { createEvent } = await import("@/features/events/server/event-service");

    mockTables.listRows.mockResolvedValueOnce({ rows: [] });
    mockTables.createRow.mockResolvedValueOnce(
      toEventRow(createEventFixture({ $id: "event-new", created_by: "creator-user" })),
    );

    await createEvent(
      {
        reference: "MF-5",
        start_date: "2026-06-01T00:00:00.000Z",
        term: "2025/2026",
        title: "New Event",
        year: 2026,
      },
      "creator-user",
      { isAdmin: false },
    );

    expect(assignEventRole).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "Chair",
        userId: "creator-user",
      }),
    );
  });

  it("createEvent with Admin creator does NOT auto-assign chair role", async () => {
    const { assignEventRole } = await import("@/features/access-control/server/roles");
    const { createEvent } = await import("@/features/events/server/event-service");

    mockTables.listRows.mockResolvedValueOnce({ rows: [] });
    mockTables.createRow.mockResolvedValueOnce(
      toEventRow(createEventFixture({ $id: "event-new", created_by: "admin-user" })),
    );

    await createEvent(
      {
        reference: "MF-6",
        start_date: "2026-06-01T00:00:00.000Z",
        term: "2025/2026",
        title: "Admin Event",
        year: 2026,
      },
      "admin-user",
      { isAdmin: true },
    );

    expect(assignEventRole).not.toHaveBeenCalled();
  });

  it("createEvent auto-assignment failure rolls back event creation", async () => {
    const { assignEventRole } = await import("@/features/access-control/server/roles");
    const { createEvent } = await import("@/features/events/server/event-service");

    vi.mocked(assignEventRole).mockRejectedValueOnce(new Error("assignment failed"));
    mockTables.listRows.mockResolvedValueOnce({ rows: [] });
    mockTables.createRow.mockResolvedValueOnce(
      toEventRow(createEventFixture({ $id: "event-rollback", created_by: "creator-user" })),
    );
    mockTables.deleteRow.mockResolvedValueOnce(undefined);

    await expect(
      createEvent(
        {
          reference: "MF-7",
          start_date: "2026-06-01T00:00:00.000Z",
          term: "2025/2026",
          title: "Rollback Event",
          year: 2026,
        },
        "creator-user",
        { isAdmin: false },
      ),
    ).rejects.toThrow("assignment failed");

    expect(mockTables.deleteRow).toHaveBeenCalledWith("test-db", "events", "event-rollback");
  });

  it("getEvents: non-admin can see draft events they created", async () => {
    const { getEvents } = await import("@/features/events/server/event-service");
    const { getActiveEventRoleAssignments } = await import(
      "@/features/access-control/server/roles"
    );

    vi.mocked(getActiveEventRoleAssignments).mockResolvedValueOnce([]);
    mockTables.listRows.mockResolvedValueOnce({
      rows: [
        toEventRow(createEventFixture({ created_by: "user-1", status: "draft" })),
        toEventRow(
          createEventFixture({
            $id: "event-2",
            created_by: "other-user",
            status: "draft",
          }),
        ),
      ],
    });

    const result = await getEvents({ isAdmin: false, userId: "user-1" });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.created_by).toBe("user-1");
  });

  it("createEvent with duplicate reference throws ConflictError", async () => {
    const { createEvent } = await import("@/features/events/server/event-service");
    const { ConflictError } = await import("@/server/errors");

    mockTables.listRows.mockResolvedValueOnce({
      rows: [toEventRow(createEventFixture())],
    });

    await expect(
      createEvent(
        {
          reference: "MF-4",
          start_date: "2026-06-01T00:00:00.000Z",
          term: "2025/2026",
          title: "Duplicate",
          year: 2026,
        },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("deleteEvent on a published event throws ForbiddenError", async () => {
    const { deleteEvent } = await import("@/features/events/server/event-service");
    const { ForbiddenError } = await import("@/server/errors");

    mockTables.getRow.mockResolvedValueOnce(
      toEventRow(createEventFixture({ status: "published" })),
    );

    await expect(deleteEvent("event-1", "admin-user")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("create event validation", () => {
  it("createEvent with end_date before start_date fails Zod validation", async () => {
    const { CreateEventInputSchema } = await import("@/features/events/types");
    const parsed = CreateEventInputSchema.safeParse({
      end_date: "2026-05-01T00:00:00.000Z",
      reference: "MF-8",
      start_date: "2026-06-01T00:00:00.000Z",
      term: "2025/2026",
      title: "Invalid Dates",
      year: 2026,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("end_date must be after start_date");
    }
  });
});
