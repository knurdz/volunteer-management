import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransaction: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
  updateTransaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    ADMIN_EMAIL: "admin@example.com",
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: "database",
  }),
}));
vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: () => ({
    tables: {
      createTransaction: mocks.createTransaction,
      getRow: mocks.getRow,
      listRows: mocks.listRows,
      updateRow: mocks.updateRow,
      updateTransaction: mocks.updateTransaction,
    },
  }),
}));
vi.mock("@/server/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

import {
  activateIeeeTerm,
  listAuditLogs,
  reconcileActiveTermState,
} from "../src/features/system-settings/server/settings";

function termRow({
  active,
  endDate,
  id,
  label,
  startDate,
  status,
  updatedAt,
}: {
  active: boolean;
  endDate: string;
  id: string;
  label: string;
  startDate: string;
  status: "ACTIVE" | "CLOSED" | "DRAFT";
  updatedAt: string;
}) {
  return {
    $id: id,
    active,
    createdAt: "2025-01-01T00:00:00.000Z",
    createdBy: "admin-1",
    endDate,
    label,
    notes: "",
    startDate,
    status,
    updatedAt,
    updatedBy: "admin-1",
  };
}

describe("system settings lifecycle persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTransaction.mockResolvedValue({ $id: "transaction-1" });
    mocks.updateTransaction.mockResolvedValue({});
    mocks.getRow.mockResolvedValue({
      $id: "active_term_id",
      key: "active_term_id",
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedBy: "admin-1",
      value: "",
    });
    mocks.updateRow.mockImplementation(async (input) => ({
      $id: input.rowId,
      ...input.data,
    }));
  });

  it("audits the previous term when activation closes it automatically", async () => {
    const previousTerm = termRow({
      active: true,
      endDate: "2025-09-30",
      id: "term-2024",
      label: "2024/25",
      startDate: "2024-10-01",
      status: "ACTIVE",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });
    const nextTerm = termRow({
      active: false,
      endDate: "2026-09-30",
      id: "term-2025",
      label: "2025/26",
      startDate: "2025-10-01",
      status: "DRAFT",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mocks.listRows.mockResolvedValue({
      rows: [nextTerm, previousTerm],
      total: 2,
    });
    mocks.updateRow.mockImplementation(async (input) => {
      if (input.tableId === "ieee_terms") {
        const source = input.rowId === previousTerm.$id ? previousTerm : nextTerm;
        return { ...source, ...input.data };
      }

      return { $id: input.rowId, ...input.data };
    });

    await activateIeeeTerm({
      actorUserId: "admin-1",
      termId: nextTerm.$id,
    });

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "IEEE_TERM_CLOSED",
        metadata: {
          after: { active: false, status: "CLOSED" },
          before: { active: true, status: "ACTIVE" },
          reason: "ACTIVE_TERM_REPLACED",
          replacementTermId: nextTerm.$id,
        },
        targetId: previousTerm.$id,
        transactionId: "transaction-1",
      }),
    );
  });

  it("persists and audits contradictory active-state repairs", async () => {
    const contradictoryTerm = termRow({
      active: true,
      endDate: "2026-09-30",
      id: "term-draft",
      label: "2025/26",
      startDate: "2025-10-01",
      status: "DRAFT",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await reconcileActiveTermState("system", [contradictoryTerm]);

    expect(mocks.updateRow).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          active: false,
          status: "DRAFT",
        }),
        rowId: contradictoryTerm.$id,
        transactionId: "transaction-1",
      }),
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "IEEE_TERM_STATE_REPAIRED",
        metadata: {
          after: { active: false, status: "DRAFT" },
          before: { active: true, status: "DRAFT" },
          reason: "DRAFT_ACTIVE_FLAG_CLEARED",
          selectedActiveTermId: "",
        },
        targetId: contradictoryTerm.$id,
        transactionId: "transaction-1",
      }),
    );
  });

  it("returns cursor-paginated audit pages with the complete filtered total", async () => {
    const rows = ["audit-1", "audit-2", "audit-3"].map((id, index) => ({
      $id: id,
      action: "IEEE_TERM_UPDATED",
      actorUserId: "admin-1",
      createdAt: `2026-01-0${index + 1}T00:00:00.000Z`,
      metadata: "",
      targetId: `term-${index + 1}`,
      targetType: "ieee_term",
    }));
    mocks.listRows.mockResolvedValue({ rows, total: 8 });

    await expect(listAuditLogs({ limit: 2 })).resolves.toEqual({
      auditLogs: rows.slice(0, 2).map((row) => ({
        $id: row.$id,
        action: row.action,
        actorUserId: row.actorUserId,
        createdAt: row.createdAt,
        metadata: undefined,
        targetId: row.targetId,
        targetType: row.targetType,
      })),
      nextCursor: "audit-2",
      total: 8,
    });
  });
});
