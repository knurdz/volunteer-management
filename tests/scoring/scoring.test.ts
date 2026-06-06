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
  submitGradeReview,
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
  canVolunteer: () => true,
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
    expect(calculateAverageGrade([8, 9])).toBe(9); // rounds up
    expect(calculateAverageGrade([6, 7])).toBe(7); // rounds to nearest
    expect(calculateAverageGrade([7, 7, 8])).toBe(7); // rounds to nearest
  });

  it("isEligibleForTopBoard respects exclusion config", () => {
    const config = [
      {
        $id: "1",
        userId: "user-1",
        term: "2026/2027",
        year: 2026,
        excludedFromTopBoard: true,
        setBy: "admin",
      },
    ];

    expect(isEligibleForTopBoard("user-1", "2026/2027", 2026, config)).toBe(false);
    expect(isEligibleForTopBoard("user-2", "2026/2027", 2026, config)).toBe(true);
    expect(isEligibleForTopBoard("user-1", "2027/2028", 2027, config)).toBe(true);
  });

  it("filterLedgerByMonth returns correct entries for Volunteer of the Month", () => {
    const ledger = [
      {
        $id: "1",
        userId: "user-1",
        eventId: "event-1",
        points: 5,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        term: "2026/2027",
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
        term: "2026/2027",
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
        points: 5,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        term: "2026/2027",
        source: "grade" as const,
        createdBy: "admin",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
      {
        $id: "2",
        userId: "user-1",
        eventId: "event-2",
        points: 1,
        conclusionApprovalDate: "2027-01-15T12:00:00.000Z",
        term: "2026/2027",
        source: "role" as const,
        createdBy: "admin",
        createdAt: "2027-01-15T12:00:00.000Z",
      },
    ];

    const entries2026 = filterLedgerByTerm(ledger, "2026/2027");
    expect(entries2026.length).toBe(2);
  });

  it("sumPointsFromLedger reproduces totals correctly", () => {
    const ledger = [
      {
        $id: "1",
        userId: "user-1",
        eventId: "event-1",
        points: 4,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        term: "2026/2027",
        source: "grade" as const,
        createdBy: "admin",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
      {
        $id: "2",
        userId: "user-1",
        eventId: "event-2",
        points: 2,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        term: "2026/2027",
        source: "role" as const,
        createdBy: "admin",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
    ];

    expect(sumPointsFromLedger(ledger)).toBe(6);
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
      listRows: vi.fn().mockImplementation((db: string, table: string) => {
        if (table === "participation_records") {
          return Promise.resolve({
            total: 1,
            rows: [{ $id: "pr1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", status: "attended" }],
          });
        }
        return Promise.resolve({ total: 0, rows: [] });
      }),
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

    await expect(
      createGradeRequest({ eventId: "event-1", targetUserId: "volunteer-1", gradeValue: 8 })
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
      gradeValue: 9,
    });

    expect(result).toBeDefined();
    expect(mockTables.createRow).toHaveBeenCalled();
  });

  it("Point ledger uses conclusionApprovalDate from audit logs, delta is computed", async () => {
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
            { gradeRequestId: "request-1", reviewerId: "reviewer-1", gradeValue: 8 },
            { gradeRequestId: "request-1", reviewerId: "reviewer-2", gradeValue: 9 },
          ],
        });
      }
      if (table === "audit_logs") {
        return Promise.resolve({
          total: 1,
          rows: [
            {
              $id: "log-1",
              action: "CONCLUSION_REPORT_APPROVED",
              targetType: "event",
              targetId: "event-1",
              createdAt: "2026-06-15T00:00:00.000Z",
            },
          ],
        });
      }
      if (table === "participation_records") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "pr1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", status: "attended" }],
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    vi.mocked(hasEventRole).mockReturnValue(true);

    const result = await finalizeGrade("request-1");

    expect(result.status).toBe("finalized");
    expect(mockTables.createRow).toHaveBeenCalledWith(
      "database-1",
      "point_ledger",
      expect.any(String),
      expect.objectContaining({
        conclusionApprovalDate: "2026-06-15T00:00:00.000Z",
        points: 9, // average of 8 and 9 (rounded)
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
          gradeValue: 7,
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

    const result = await adminOverrideGrade("review-1", 8, "Incorrect scoring input");

    expect(result.gradeValue).toBe(8);
    expect(mockTables.updateRow).toHaveBeenCalledWith(
      "database-1",
      "grade_reviews",
      "review-1",
      expect.objectContaining({
        gradeValue: 8,
        audit_metadata: expect.stringContaining('"originalValue":7,"newValue":8'),
      })
    );

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "GRADE_OVERRIDDEN",
        actorUserId: "admin-1",
        metadata: {
          gradeReviewId: "review-1",
          originalValue: 7,
          newValue: 8,
          reason: "Incorrect scoring input",
        },
      })
    );
  });

  it("Fails finalization if no approved conclusion report log exists", async () => {
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

    // Mock audit logs to return empty (not approved yet)
    mockTables.listRows.mockImplementation((db, table) => {
      if (table === "audit_logs") {
        return Promise.resolve({ total: 0, rows: [] });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    vi.mocked(hasEventRole).mockReturnValue(true);

    await expect(finalizeGrade("request-1")).rejects.toThrow(
      "Conclusion report for this event is not approved by Admin."
    );
  });

  it("Blocks Committee Members from submitting reviews", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "member-1", name: "Member User", email: "mem@uom.lk" },
      profile: { $id: "mem-1", authUserId: "member-1", googleEmail: "mem@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r3",
          userId: "member-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Committee Member",
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
      status: "pending",
    });

    vi.mocked(hasEventRole).mockReturnValue(false);

    await expect(submitGradeReview("request-1", 7)).rejects.toThrow(
      "Only authorized event reviewers or admins can submit reviews."
    );
  });

  it("Throws if grade target is not a valid event participant", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: [],
      eventRoles: [],
    });

    // Mock participation to return 0 records
    mockTables.listRows.mockImplementation((db, table) => {
      if (table === "participation_records") {
        return Promise.resolve({ total: 0, rows: [] });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    await expect(
      createGradeRequest({ eventId: "event-1", targetUserId: "volunteer-1", gradeValue: 7 })
    ).rejects.toThrow("Target user is not a participant in this event.");
  });

  it("Blocks normal edits/reviews if request status is finalized", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: [],
      eventRoles: [],
    });

    mockTables.getRow.mockResolvedValue({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "volunteer-1",
      status: "finalized",
    });

    // Submitting review on finalized request
    await expect(submitGradeReview("request-1", 7)).rejects.toThrow(
      "Cannot submit review for a finalized grade request."
    );
  });

  it("Recalculate preserves existing entries and appends delta correctly", async () => {
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

    // Mock existing point ledger records
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "point_ledger") {
        return Promise.resolve({
          total: 2,
          rows: [
            // Already has 5 points from grade
            { $id: "l1", userId: "volunteer-1", eventId: "event-1", points: 5, source: "grade", conclusionApprovalDate: "2026-06-15T00:00:00.000Z", term: "2026/2027" },
            // Already has 10 points from role
            { $id: "l2", userId: "volunteer-1", eventId: "event-1", points: 10, source: "role", conclusionApprovalDate: "2026-06-15T00:00:00.000Z", term: "2026/2027" },
          ],
        });
      }
      if (table === "grade_reviews") {
        return Promise.resolve({
          total: 1,
          rows: [{ gradeRequestId: "request-1", reviewerId: "reviewer-1", gradeValue: 8 }], // new average grade target is 8
        });
      }
      if (table === "audit_logs") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "log-1", action: "CONCLUSION_REPORT_APPROVED", targetType: "event", targetId: "event-1", createdAt: "2026-06-15T00:00:00.000Z" }],
        });
      }
      if (table === "participation_records") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "pr1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", status: "attended" }], // role points = 10
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    vi.mocked(hasEventRole).mockReturnValue(true);

    const result = await finalizeGrade("request-1");

    expect(result.status).toBe("finalized");
    // Should NOT call deleteRow
    expect(mockTables.deleteRow).not.toHaveBeenCalled();
    // Should append the delta for grade (+3 points, from 5 to 8)
    expect(mockTables.createRow).toHaveBeenCalledWith(
      "database-1",
      "point_ledger",
      expect.any(String),
      expect.objectContaining({
        points: 3, // delta
        source: "grade",
      })
    );
    // Should NOT append delta for role (since it is already 10)
    expect(mockTables.createRow).not.toHaveBeenCalledWith(
      "database-1",
      "point_ledger",
      expect.any(String),
      expect.objectContaining({
        points: expect.any(Number),
        source: "role",
      })
    );
  });
});
