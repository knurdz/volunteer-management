import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventCommittee } from "@/features/events/types";

const mockTables = {
  createRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: () => ({
    tables: mockTables,
  }),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: "test-db",
  }),
}));

vi.mock("@/features/events/server/event-service", async () => {
  const actual = await vi.importActual<typeof import("@/features/events/server/event-service")>(
    "@/features/events/server/event-service",
  );

  return {
    ...actual,
    getEventById: vi.fn(),
  };
});

function createCommitteeRow(
  overrides: Partial<EventCommittee> & Pick<EventCommittee, "$id" | "event_id" | "user_id" | "role">,
): EventCommittee {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    assigned_at: "2026-01-01T00:00:00.000Z",
    assigned_by: "admin-user",
    display_role: overrides.role === "chair" ? "Chair" : undefined,
    is_active: true,
    ...overrides,
  };
}

function toAppRow(committee: EventCommittee) {
  return {
    $createdAt: committee.$createdAt,
    $id: committee.$id,
    $updatedAt: committee.$updatedAt,
    assigned_at: committee.assigned_at,
    assigned_by: committee.assigned_by,
    committee_name: committee.committee_name ?? "",
    display_role: committee.display_role ?? "",
    event_id: committee.event_id,
    is_active: committee.is_active,
    role: committee.role,
    user_id: committee.user_id,
  };
}

describe("committee-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assignEventRole", () => {
    it("deactivates an existing active role before creating a new one", async () => {
      const { assignEventRole } = await import("@/features/events/server/committee-service");
      const existing = createCommitteeRow({
        $id: "committee-old",
        event_id: "event-1",
        role: "committee_member",
        user_id: "user-1",
      });
      const created = createCommitteeRow({
        $id: "committee-new",
        event_id: "event-1",
        role: "vice_chair",
        user_id: "user-1",
      });

      mockTables.listRows.mockResolvedValueOnce({ rows: [toAppRow(existing)] });
      mockTables.updateRow.mockResolvedValueOnce({ ...toAppRow(existing), is_active: false });
      mockTables.createRow.mockResolvedValueOnce(toAppRow(created));

      const result = await assignEventRole(
        {
          event_id: "event-1",
          role: "vice_chair",
          user_id: "user-1",
        },
        "admin-user",
      );

      expect(mockTables.updateRow).toHaveBeenCalledWith(
        "test-db",
        "event_committees",
        "committee-old",
        { is_active: false },
      );
      expect(mockTables.createRow).toHaveBeenCalledWith(
        "test-db",
        "event_committees",
        expect.any(String),
        expect.objectContaining({
          event_id: "event-1",
          is_active: true,
          role: "vice_chair",
          user_id: "user-1",
          assigned_by: "admin-user",
        }),
      );
      expect(result.$id).toBe("committee-new");
      expect(result.role).toBe("vice_chair");
    });
  });

  describe("updateCoChairDisplayRoles", () => {
    it('sets a single active chair display role to "Chair"', async () => {
      const { updateCoChairDisplayRoles } = await import(
        "@/features/events/server/committee-service"
      );
      const chair = createCommitteeRow({
        $id: "chair-1",
        event_id: "event-1",
        role: "chair",
        user_id: "user-1",
      });

      mockTables.listRows.mockResolvedValueOnce({ rows: [toAppRow(chair)] });
      mockTables.updateRow.mockResolvedValueOnce({
        ...toAppRow(chair),
        display_role: "Chair",
      });

      await updateCoChairDisplayRoles("event-1");

      expect(mockTables.updateRow).toHaveBeenCalledWith(
        "test-db",
        "event_committees",
        "chair-1",
        { display_role: "Chair" },
      );
    });

    it('sets all active chairs to "Co-chair" when more than one exists', async () => {
      const { updateCoChairDisplayRoles } = await import(
        "@/features/events/server/committee-service"
      );
      const chairs = [
        createCommitteeRow({
          $id: "chair-1",
          event_id: "event-1",
          role: "chair",
          user_id: "user-1",
        }),
        createCommitteeRow({
          $id: "chair-2",
          event_id: "event-1",
          role: "chair",
          user_id: "user-2",
        }),
      ];

      mockTables.listRows.mockResolvedValueOnce({ rows: chairs.map(toAppRow) });
      mockTables.updateRow.mockImplementation(async (_db, _table, id: string) =>
        toAppRow(chairs.find((chair) => chair.$id === id)!),
      );

      await updateCoChairDisplayRoles("event-1");

      expect(mockTables.updateRow).toHaveBeenCalledTimes(2);
      expect(mockTables.updateRow).toHaveBeenCalledWith(
        "test-db",
        "event_committees",
        "chair-1",
        { display_role: "Co-chair" },
      );
      expect(mockTables.updateRow).toHaveBeenCalledWith(
        "test-db",
        "event_committees",
        "chair-2",
        { display_role: "Co-chair" },
      );
    });
  });

  describe("removeEventRole", () => {
    it("soft deletes the assignment while keeping the record", async () => {
      const { removeEventRole } = await import("@/features/events/server/committee-service");
      const committee = createCommitteeRow({
        $id: "committee-1",
        event_id: "event-1",
        role: "committee_member",
        user_id: "user-1",
      });

      mockTables.getRow.mockResolvedValueOnce(toAppRow(committee));
      mockTables.updateRow.mockResolvedValueOnce({ ...toAppRow(committee), is_active: false });

      await removeEventRole("committee-1", "admin-user");

      expect(mockTables.updateRow).toHaveBeenCalledWith(
        "test-db",
        "event_committees",
        "committee-1",
        { is_active: false },
      );
      expect(mockTables.getRow).toHaveBeenCalledWith(
        "test-db",
        "event_committees",
        "committee-1",
      );
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
        actorCommitteeRole: "chair",
        isAdmin: false,
        targetRole: "chair",
      }),
    ).toBe(false);

    expect(
      canAssignCommitteeRole({
        actorCommitteeRole: "chair",
        isAdmin: false,
        targetRole: "vice_chair",
      }),
    ).toBe(true);

    expect(
      canAssignCommitteeRole({
        actorCommitteeRole: null,
        isAdmin: false,
        targetRole: "chair",
      }),
    ).toBe(false);

    expect(
      canAssignCommitteeRole({
        actorCommitteeRole: null,
        isAdmin: true,
        targetRole: "chair",
      }),
    ).toBe(true);
  });
});
