import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/features/events/server/event-audit", () => ({
  safeEventAuditLog: vi.fn(),
}));

describe("committee workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a structural committee for an event", async () => {
    const { createCommittee } = await import("@/features/events/server/committees.server");

    mockTables.createRow.mockResolvedValueOnce({
      $createdAt: "2026-01-01T00:00:00.000Z",
      $id: "committee-1",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      description: "Logistics",
      event_id: "event-1",
      name: "Logistics",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const committee = await createCommittee(
      {
        event_id: "event-1",
        name: "Logistics",
      },
      "chair-user",
    );

    expect(committee.name).toBe("Logistics");
    expect(mockTables.createRow).toHaveBeenCalledWith(
      "test-db",
      "event_committees",
      expect.any(String),
      expect.objectContaining({
        event_id: "event-1",
        name: "Logistics",
      }),
    );
  });
});
