import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activateIeeeTerm: vi.fn(),
  addTopBoardExclusion: vi.fn(),
  createIeeeTerm: vi.fn(),
  getPermissionOverview: vi.fn(),
  listAuditLogs: vi.fn(),
  listIeeeTerms: vi.fn(),
  listTopBoardExclusions: vi.fn(),
  requireAdmin: vi.fn(),
  revokeTopBoardExclusion: vi.fn(),
  updateIeeeTerm: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/access-control/server/current-user", () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/features/system-settings/server/settings", () => ({
  activateIeeeTerm: mocks.activateIeeeTerm,
  createIeeeTerm: mocks.createIeeeTerm,
  getPermissionOverview: mocks.getPermissionOverview,
  listAuditLogs: mocks.listAuditLogs,
  listIeeeTerms: mocks.listIeeeTerms,
  updateIeeeTerm: mocks.updateIeeeTerm,
}));
vi.mock("@/features/system-settings/server/top-board-exclusions", () => ({
  addTopBoardExclusion: mocks.addTopBoardExclusion,
  listTopBoardExclusions: mocks.listTopBoardExclusions,
  revokeTopBoardExclusion: mocks.revokeTopBoardExclusion,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ ADMIN_EMAIL: "admin@example.com" }),
}));

import {
  GET as getTerms,
  POST as createTerm,
} from "../src/app/api/admin/settings/terms/route";
import { PATCH as updateTerm } from "../src/app/api/admin/settings/terms/[termId]/route";
import { POST as activateTerm } from "../src/app/api/admin/settings/terms/[termId]/activate/route";
import {
  GET as getExclusions,
  POST as addExclusion,
} from "../src/app/api/admin/settings/top-board-exclusions/route";
import { POST as revokeExclusion } from "../src/app/api/admin/settings/top-board-exclusions/[exclusionId]/revoke/route";
import { GET as getPermissions } from "../src/app/api/admin/settings/permissions/route";
import { GET as getAuditLogs } from "../src/app/api/admin/settings/audit-logs/route";

describe("system settings API authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockRejectedValue(new Error("Authentication required."));
  });

  it.each([
    ["GET terms", () => getTerms()],
    [
      "POST terms",
      () =>
        createTerm(
          new Request("http://localhost/api/admin/settings/terms", {
            body: JSON.stringify({
              endDate: "2026-09-30",
              label: "2025/26",
              startDate: "2025-10-01",
            }),
            method: "POST",
          }),
        ),
    ],
    [
      "PATCH term",
      () =>
        updateTerm(
          new Request("http://localhost/api/admin/settings/terms/term-1", {
            body: JSON.stringify({
              endDate: "2026-09-30",
              label: "2025/26",
              startDate: "2025-10-01",
              status: "DRAFT",
            }),
            method: "PATCH",
          }),
          { params: Promise.resolve({ termId: "term-1" }) },
        ),
    ],
    [
      "POST activate term",
      () =>
        activateTerm(
          new Request("http://localhost", { method: "POST" }),
          { params: Promise.resolve({ termId: "term-1" }) },
        ),
    ],
    [
      "GET exclusions",
      () =>
        getExclusions(
          new Request(
            "http://localhost/api/admin/settings/top-board-exclusions?termId=term-1",
          ),
        ),
    ],
    [
      "POST exclusions",
      () =>
        addExclusion(
          new Request("http://localhost/api/admin/settings/top-board-exclusions", {
            body: JSON.stringify({
              reason: "Top Board member",
              termId: "term-1",
              userId: "user-1",
            }),
            method: "POST",
          }),
        ),
    ],
    [
      "POST revoke exclusion",
      () =>
        revokeExclusion(
          new Request("http://localhost", { method: "POST" }),
          { params: Promise.resolve({ exclusionId: "exclusion-1" }) },
        ),
    ],
    ["GET permissions", () => getPermissions()],
    [
      "GET audit logs",
      () =>
        getAuditLogs(
          new Request("http://localhost/api/admin/settings/audit-logs"),
        ),
    ],
  ])("returns 401 before executing %s", async (_label, callRoute) => {
    const response = await callRoute();

    expect(response.status).toBe(401);
  });

  it("does not execute settings services after authorization fails", async () => {
    await getTerms();
    await getPermissions();
    await getAuditLogs(
      new Request("http://localhost/api/admin/settings/audit-logs"),
    );

    expect(mocks.listIeeeTerms).not.toHaveBeenCalled();
    expect(mocks.getPermissionOverview).not.toHaveBeenCalled();
    expect(mocks.listAuditLogs).not.toHaveBeenCalled();
  });
});
