import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIeeeTerm: vi.fn(),
  getProfile: vi.fn(),
  getRow: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/access-control/server/profiles", () => ({
  getProfile: mocks.getProfile,
}));
vi.mock("@/features/system-settings/server/settings", () => ({
  getIeeeTerm: mocks.getIeeeTerm,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: "database",
  }),
}));
vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: () => ({
    tables: {
      getRow: mocks.getRow,
    },
  }),
}));
vi.mock("@/server/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

import {
  addTopBoardExclusion,
  revokeTopBoardExclusion,
} from "../src/features/system-settings/server/top-board-exclusions";

const existingExclusion = {
  $id: "exclusion-1",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "admin-1",
  reason: "Top Board member",
  revokedAt: null,
  revokedBy: "",
  termId: "term-1",
  userId: "user-1",
};

describe("Top Board exclusion idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIeeeTerm.mockResolvedValue({ $id: "term-1" });
    mocks.getProfile.mockResolvedValue({
      authUserId: "user-1",
      status: "ACTIVE",
    });
  });

  it("returns an existing active exclusion without writing another audit record", async () => {
    mocks.getRow.mockResolvedValue(existingExclusion);

    await expect(
      addTopBoardExclusion({
        actorUserId: "admin-1",
        reason: "Top Board member",
        termId: "term-1",
        userId: "user-1",
      }),
    ).resolves.toMatchObject({ active: true, $id: "exclusion-1" });

    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("returns an already revoked exclusion without updating or auditing it again", async () => {
    mocks.getRow.mockResolvedValue({
      ...existingExclusion,
      active: false,
      revokedAt: "2026-02-01T00:00:00.000Z",
      revokedBy: "admin-1",
    });

    await expect(
      revokeTopBoardExclusion({
        actorUserId: "admin-1",
        exclusionId: "exclusion-1",
      }),
    ).resolves.toMatchObject({
      active: false,
      revokedAt: "2026-02-01T00:00:00.000Z",
    });

    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
