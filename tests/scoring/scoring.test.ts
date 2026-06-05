import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock server-only before any other imports
vi.mock("server-only", () => ({}));

import {
  calculateAverageGrade,
  isEligibleForTopBoard,
  filterLedgerByMonth,
  filterLedgerByTerm,
  sumPointsFromLedger,
  isSelfEventGrade,
} from "../../src/features/scoring/lib/helpers";
import {
  createGradeRequest,
  finalizeGrade,
  adminOverrideGrade,
} from "../../src/features/scoring/server/actions";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { requireAuth, requireAdmin } from "@/features/access-control/server/current-user";
import { hasEventRole } from "@/features/access-control/lib/rules";
import { writeAuditLog } from "@/server/audit";
import type { TablesDB } from "node-appwrite";

// Mocks
vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: vi.fn(),
}));

vi.mock("@/features/access-control/server/current-user", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/features/access-control/lib/rules", () => ({
  hasEventRole: vi.fn(),
}));

vi.mock("@/server/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: "database-1",
  }),
}));

describe("Scoring Pure Helper Functions", () => {
  it("calculateAverageGrade averages multiple reviewers and handles empty arrays", () => {
    expect(calculateAverageGrade([])).toBe(0);
    expect(calculateAverageGrade([80, 90])).toBe(85);
    expect(calculateAverageGrade([66, 67])).toBe(67); // rounds up
    expect(calculateAverageGrade([70, 71, 71])).toBe(71); // rounds to nearest
  });

  it("isEligibleForTopBoard respects exclusion config", () => {
    const config = [
      {
        $id: "1",
        userId: "user-1",
        term: "2026",
        year: 2026,
        excludedFromTopBoard: true,
        setBy: "admin",
      },
    ];

    expect(isEligibleForTopBoard("user-1", "2026", 2026, config)).toBe(false);
    expect(isEligibleForTopBoard("user-2", "2026", 2026, config)).toBe(true);
    expect(isEligibleForTopBoard("user-1", "2027", 2027, config)).toBe(true);
  });

  it("filterLedgerByMonth returns correct entries for Volunteer of the Month", () => {
    const ledger = [
      {
        $id: "1",
        userId: "user-1",
        eventId: "event-1",
        points: 50,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        source: "grade" as const,
        createdBy: "admin",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
      {
        $id: "2",
        userId: "user-1",
        eventId: "event-2",
        points: 10,
        conclusionApprovalDate: "2026-07-01T12:00:00.000Z",
        source: "role" as const,
        createdBy: "admin",
        createdAt: "2026-07-01T12:00:00.000Z",
      },
    ];

    const juneEntries = filterLedgerByMonth(ledger, 6, 2026);
    expect(juneEntries.length).toBe(1);
    expect(juneEntries[0].$id).toBe("1");

    const julyEntries = filterLedgerByMonth(ledger, 7, 2026);
    expect(julyEntries.length).toBe(1);
    expect(julyEntries[0].$id).toBe("2");
  });

  it("filterLedgerByTerm returns correct yearly entries", () => {
    const ledger = [
      {
        $id: "1",
        userId: "user-1",
        eventId: "event-1",
        points: 50,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        source: "grade" as const,
        createdBy: "admin",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
      {
        $id: "2",
        userId: "user-1",
        eventId: "event-2",
        points: 10,
        conclusionApprovalDate: "2027-01-15T12:00:00.000Z",
        source: "role" as const,
        createdBy: "admin",
        createdAt: "2027-01-15T12:00:00.000Z",
      },
    ];

    const entries2026 = filterLedgerByTerm(ledger, "2026", 2026);
    expect(entries2026.length).toBe(1);
    expect(entries2026[0].$id).toBe("1");
  });

  it("sumPointsFromLedger reproduces totals correctly", () => {
    const ledger = [
      {
        $id: "1",
        userId: "user-1",
        eventId: "event-1",
        points: 45,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        source: "grade" as const,
        createdBy: "admin",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
      {
        $id: "2",
        userId: "user-1",
        eventId: "event-2",
        points: 25,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        source: "role" as const,
        createdBy: "admin",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
    ];

    expect(sumPointsFromLedger(ledger)).toBe(70);
  });

  it("isSelfEventGrade flags grading when user is a Chair of the event", () => {
    expect(isSelfEventGrade("user-1", "event-1", ["event-1", "event-2"])).toBe(true);
    expect(isSelfEventGrade("user-1", "event-3", ["event-1", "event-2"])).toBe(false);
  });
});

describe("Scoring Server Actions & Access Control", () => {
  type MockTables = {
    listRows: ReturnType<typeof vi.fn>;
    getRow: ReturnType<typeof vi.fn>;
    createRow: ReturnType<typeof vi.fn>;
    updateRow: ReturnType<typeof vi.fn>;
    deleteRow: ReturnType<typeof vi.fn>;
  };
  let mockTables: MockTables;

  beforeEach(() => {
    vi.resetAllMocks();

    mockTables = {
      listRows: vi.fn().mockResolvedValue({ total: 0, rows: [] }),
      getRow: vi.fn(),
      createRow: vi.fn().mockImplementation((db, table, id, data) => Promise.resolve({ $id: id, ...data })),
      updateRow: vi.fn().mockImplementation((db, table, id, data) => Promise.resolve({ $id: id, ...data })),
      deleteRow: vi.fn().mockResolvedValue({}),
    };

    vi.mocked(getAppwriteAdminServices).mockReturnValue({
      tables: mockTables as unknown as TablesDB,
    } as unknown as ReturnType<typeof getAppwriteAdminServices>);
  });

  it("Chair self-event grading is blocked server-side", async () => {
    // Current user is chair
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "chair-1", name: "Chair User", email: "chair@uom.lk" },
      profile: { $id: "chair-1", authUserId: "chair-1", googleEmail: "chair@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r1",
          userId: "chair-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Chair",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    vi.mocked(hasEventRole).mockReturnValue(true);

    // Call action
    await expect(
      createGradeRequest({ eventId: "event-1", targetUserId: "volunteer-1", gradeValue: 85 })
    ).rejects.toThrow("Chairs cannot grade participants under their own event.");
  });

  it("Admin can grade any participant without event restrictions", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin User", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: ["ExCom"],
      eventRoles: [],
    });

    const result = await createGradeRequest({
      eventId: "event-1",
      targetUserId: "volunteer-1",
      gradeValue: 90,
    });

    expect(result).toBeDefined();
    expect(mockTables.createRow).toHaveBeenCalled();
  });

  it("Point ledger uses conclusionApprovalDate, not event creation date", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "reviewer-1", name: "Reviewer User", email: "rev@uom.lk" },
      profile: { $id: "rev-1", authUserId: "reviewer-1", googleEmail: "rev@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r2",
          userId: "reviewer-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Committee Lead",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    mockTables.getRow.mockResolvedValue({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "volunteer-1",
      status: "reviewed",
    });

    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "grade_reviews") {
        return Promise.resolve({
          total: 2,
          rows: [
            { gradeRequestId: "request-1", reviewerId: "reviewer-1", gradeValue: 80 },
            { gradeRequestId: "request-1", reviewerId: "reviewer-2", gradeValue: 90 },
          ],
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    const result = await finalizeGrade("request-1", "2026-06-15T00:00:00.000Z");

    expect(result.status).toBe("finalized");
    expect(mockTables.createRow).toHaveBeenCalledWith(
      "database-1",
      "point_ledger",
      expect.any(String),
      expect.objectContaining({
        conclusionApprovalDate: "2026-06-15T00:00:00.000Z",
        points: 85, // average of 80 and 90
        source: "grade",
      })
    );
  });

  it("Admin override writes audit record with original + new value", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin User", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: ["ExCom"],
      eventRoles: [],
    });

    mockTables.getRow.mockImplementation((db: string, table: string, id: string) => {
      if (table === "grade_reviews") {
        return Promise.resolve({
          $id: id,
          gradeRequestId: "request-1",
          reviewerId: "reviewer-1",
          gradeValue: 75,
          audit_metadata: null,
        });
      }
      if (table === "grade_requests") {
        return Promise.resolve({
          $id: "request-1",
          eventId: "event-1",
          targetUserId: "volunteer-1",
          status: "finalized",
        });
      }
    });

    const result = await adminOverrideGrade("review-1", 85, "Incorrect scoring input");

    expect(result.gradeValue).toBe(85);
    expect(mockTables.updateRow).toHaveBeenCalledWith(
      "database-1",
      "grade_reviews",
      "review-1",
      expect.objectContaining({
        gradeValue: 85,
        audit_metadata: expect.stringContaining('"originalValue":75,"newValue":85'),
      })
    );

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "GRADE_OVERRIDDEN",
        actorUserId: "admin-1",
        metadata: {
          gradeReviewId: "review-1",
          originalValue: 75,
          newValue: 85,
          reason: "Incorrect scoring input",
        },
      })
    );
  });
});
