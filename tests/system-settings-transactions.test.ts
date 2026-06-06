import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { runTablesTransaction } from "../src/features/system-settings/server/transactions";

describe("system settings transactions", () => {
  it("commits after all staged work succeeds", async () => {
    const tables = {
      createTransaction: vi.fn().mockResolvedValue({ $id: "transaction-1" }),
      updateTransaction: vi.fn().mockResolvedValue({}),
    };
    const operation = vi.fn().mockResolvedValue("saved");

    await expect(
      runTablesTransaction(tables as never, operation),
    ).resolves.toBe("saved");
    expect(operation).toHaveBeenCalledWith("transaction-1");
    expect(tables.updateTransaction).toHaveBeenCalledWith({
      commit: true,
      transactionId: "transaction-1",
    });
    expect(tables.updateTransaction).not.toHaveBeenCalledWith(
      expect.objectContaining({ rollback: true }),
    );
  });

  it("rolls back when staged audit or persistence work fails", async () => {
    const tables = {
      createTransaction: vi.fn().mockResolvedValue({ $id: "transaction-2" }),
      updateTransaction: vi.fn().mockResolvedValue({}),
    };
    const auditFailure = new Error("audit write failed");

    await expect(
      runTablesTransaction(tables as never, async () => {
        throw auditFailure;
      }),
    ).rejects.toBe(auditFailure);
    expect(tables.updateTransaction).toHaveBeenCalledWith({
      rollback: true,
      transactionId: "transaction-2",
    });
    expect(tables.updateTransaction).not.toHaveBeenCalledWith(
      expect.objectContaining({ commit: true }),
    );
  });

  it("preserves the original failure when rollback also fails", async () => {
    const tables = {
      createTransaction: vi.fn().mockResolvedValue({ $id: "transaction-3" }),
      updateTransaction: vi.fn().mockRejectedValue(new Error("rollback failed")),
    };
    const originalFailure = new Error("operation failed");

    await expect(
      runTablesTransaction(tables as never, async () => {
        throw originalFailure;
      }),
    ).rejects.toBe(originalFailure);
  });
});
