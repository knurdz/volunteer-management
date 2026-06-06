import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRoleAssignment } from "@/features/access-control/types";

const mockTables = {
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

const mockUsers = {
  get: vi.fn(),
};

vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: () => ({
    tables: mockTables,
    users: mockUsers,
  }),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: "test-db",
  }),
}));

vi.mock("@/features/access-control/server/profiles", () => ({
  getProfile: vi.fn(),
}));

vi.mock("@/features/events/server/event-audit", () => ({
  safeEventAuditLog: vi.fn(),
}));

vi.mock("@/features/events/server/committees.server", () => ({
  hasCommitteesForEvent: vi.fn().mockResolvedValue(true),
  listCommitteesForEvent: vi.fn().mockResolvedValue([{ $id: "committee-1", name: "Program" }]),
}));

vi.mock("@/features/events/server/event-service", () => ({
  getEventById: vi.fn().mockResolvedValue({
    $id: "event-1",
    title: "Test Event",
  }),
}));

const assignAccessControlEventRole = vi.fn();
const revokeEventRole = vi.fn();

vi.mock("@/features/access-control/server/roles", () => ({
  assignEventRole: (...args: unknown[]) => assignAccessControlEventRole(...args),
  getActiveEventRoleAssignments: vi.fn().mockResolvedValue([]),
  revokeEventRole: (...args: unknown[]) => revokeEventRole(...args),
  toEventRoleAssignment: (row: Record<string, unknown>) => ({
    $id: String(row.$id),
    active: Boolean(row.active),
    assignedAt: String(row.assignedAt),
    assignedBy: String(row.assignedBy),
    committeeName: row.committeeName ? String(row.committeeName) : undefined,
    eventId: String(row.eventId),
    eventTitle: String(row.eventTitle),
    role: row.role,
    userId: String(row.userId),
  }),
}));

function createAssignment(
  overrides: Partial<EventRoleAssignment> = {},
): EventRoleAssignment {
  return {
    $id: "assignment-old",
    active: true,
    assignedAt: "2026-01-01T00:00:00.000Z",
    assignedBy: "admin-user",
    eventId: "event-1",
    eventTitle: "Test Event",
    role: "Committee Member",
    userId: "user-1",
    ...overrides,
  };
}

describe("event-roles.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assignEventRole", () => {
    it("assignEventRole with disabled user throws ValidationError", async () => {
      const { getProfile } = await import("@/features/access-control/server/profiles");
      const { assignEventRole } = await import("@/features/events/server/event-roles.server");
      const { ValidationError } = await import("@/server/errors");

      mockUsers.get.mockResolvedValueOnce({ status: true });
      vi.mocked(getProfile).mockResolvedValueOnce({
        $id: "profile-1",
        authUserId: "user-1",
        googleEmail: "user@example.com",
        status: "DISABLED",
        uomVerified: true,
      });

      await expect(
        assignEventRole(
          {
            event_id: "event-1",
            role: "Vice Chair",
            user_id: "user-1",
          },
          "admin-user",
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("assignEventRole with unverified user throws ValidationError", async () => {
      const { getProfile } = await import("@/features/access-control/server/profiles");
      const { assignEventRole } = await import("@/features/events/server/event-roles.server");
      const { ValidationError } = await import("@/server/errors");

      mockUsers.get.mockResolvedValueOnce({ status: true });
      vi.mocked(getProfile).mockResolvedValueOnce({
        $id: "profile-1",
        authUserId: "user-1",
        googleEmail: "user@example.com",
        status: "ACTIVE",
        uomVerified: false,
      });

      await expect(
        assignEventRole(
          {
            event_id: "event-1",
            role: "Vice Chair",
            user_id: "user-1",
          },
          "admin-user",
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("updateEventRole", () => {
    it("returns new assignment and writes orphan audit when delete fails", async () => {
      const { safeEventAuditLog } = await import("@/features/events/server/event-audit");
      const { updateEventRole } = await import("@/features/events/server/event-roles.server");
      const newAssignment = createAssignment({
        $id: "assignment-new",
        role: "Vice Chair",
      });

      mockTables.getRow.mockResolvedValueOnce({
        $id: "assignment-old",
        active: true,
        assignedAt: "2026-01-01T00:00:00.000Z",
        assignedBy: "admin-user",
        committeeName: "",
        eventId: "event-1",
        eventTitle: "Test Event",
        role: "Committee Member",
        userId: "user-1",
      });
      assignAccessControlEventRole.mockResolvedValueOnce(newAssignment);
      mockTables.deleteRow.mockRejectedValueOnce(new Error("delete failed"));

      const result = await updateEventRole({
        actorUserId: "admin-user",
        eventId: "event-1",
        eventTitle: "Test Event",
        newRole: "Vice Chair",
        oldAssignmentId: "assignment-old",
        userId: "user-1",
      });

      expect(result.$id).toBe("assignment-new");
      expect(safeEventAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "event_role.orphan_cleanup_needed",
          metadata: { new_id: "assignment-new", old_id: "assignment-old" },
        }),
      );
    });
  });

  describe("approveConclusion authorization", () => {
    it("approveConclusion: non-admin gets ForbiddenError via route helper permissions", async () => {
      const { getEventPermissions } = await import("@/features/events/lib/event-permissions");

      const permissions = getEventPermissions(
        "chair-user",
        false,
        {
          $createdAt: "2026-01-01T00:00:00.000Z",
          $id: "event-1",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          conclusion_status: "submitted",
          created_at: "2026-01-01T00:00:00.000Z",
          created_by: "admin-user",
          reference: "MF-4",
          start_date: "2026-06-01T00:00:00.000Z",
          status: "pending_conclusion",
          term: "Summer",
          title: "Event",
          updated_at: "2026-01-01T00:00:00.000Z",
          year: 2026,
        },
        "Chair",
      );

      expect(permissions.canApproveConclusion).toBe(false);
    });
  });
});

describe("committee permissions", () => {
  it("blocks chairs from assigning the chair role", async () => {
    const { canAssignCommitteeRole } = await import(
      "@/features/events/lib/committee-permissions"
    );

    expect(
      canAssignCommitteeRole({
        actorEventRole: "Chair",
        isAdmin: false,
        targetRole: "Chair",
      }),
    ).toBe(false);

    expect(
      canAssignCommitteeRole({
        actorEventRole: "Chair",
        isAdmin: false,
        targetRole: "Vice Chair",
      }),
    ).toBe(true);

    expect(
      canAssignCommitteeRole({
        actorEventRole: null,
        isAdmin: false,
        targetRole: "Chair",
      }),
    ).toBe(false);

    expect(
      canAssignCommitteeRole({
        actorEventRole: null,
        isAdmin: true,
        targetRole: "Chair",
      }),
    ).toBe(true);
  });
});

describe("admin verification bypass", () => {
  it("admin without verification passes requireVerifiedVolunteer", async () => {
    const { requireVerifiedVolunteer } = await import(
      "@/features/events/server/event-route-helpers"
    );

    const result = requireVerifiedVolunteer({
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
    });

    expect(result).toBeNull();
  });
});
