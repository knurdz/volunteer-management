import { describe, expect, it } from "vitest";
import {
  assertNoOverlappingTerms,
  assertTermCanBeActivated,
  assertTermCanBeUpdated,
  assertValidTermLabel,
  assertValidTermDates,
  buildPermissionOverview,
  dateRangesOverlap,
  formatTermLabel,
  getSuggestedTermRange,
  isActiveTopBoardExclusion,
  resolveActiveTermState,
} from "../src/features/system-settings/lib/rules";

describe("system settings rules", () => {
  it("formats IEEE term labels from the start year", () => {
    expect(formatTermLabel("2025-10-01")).toBe("2025/26");
    expect(formatTermLabel("2024-08-16")).toBe("2024/25");
    expect(() => assertValidTermLabel("2025/26", "2025-10-01")).not.toThrow();
    expect(() => assertValidTermLabel("Unrelated label", "2025-10-01")).toThrow(
      "must be 2025/26",
    );
  });

  it("suggests October to September terms around the current date", () => {
    expect(getSuggestedTermRange(new Date("2026-06-04T00:00:00.000Z"))).toEqual({
      endDate: "2026-09-30",
      label: "2025/26",
      startDate: "2025-10-01",
    });
    expect(getSuggestedTermRange(new Date("2026-10-01T00:00:00.000Z"))).toEqual({
      endDate: "2027-09-30",
      label: "2026/27",
      startDate: "2026-10-01",
    });
  });

  it("validates term date order and date-only format", () => {
    expect(() =>
      assertValidTermDates({ endDate: "2026-09-30", startDate: "2025-10-01" }),
    ).not.toThrow();
    expect(() =>
      assertValidTermDates({ endDate: "2025-10-01", startDate: "2025-10-01" }),
    ).toThrow("after the start date");
    expect(() =>
      assertValidTermDates({ endDate: "2026-09-30", startDate: "2025/10/01" }),
    ).toThrow("YYYY-MM-DD");
  });

  it("detects and rejects overlapping open terms", () => {
    expect(
      dateRangesOverlap(
        { endDate: "2026-09-30", startDate: "2025-10-01" },
        { endDate: "2027-09-30", startDate: "2026-10-01" },
      ),
    ).toBe(false);
    expect(
      dateRangesOverlap(
        { endDate: "2026-09-30", startDate: "2025-10-01" },
        { endDate: "2026-12-31", startDate: "2026-08-01" },
      ),
    ).toBe(true);
    expect(() =>
      assertNoOverlappingTerms(
        { endDate: "2026-12-31", startDate: "2026-08-01" },
        [
          {
            $id: "term-1",
            endDate: "2026-09-30",
            startDate: "2025-10-01",
          },
        ],
      ),
    ).toThrow("overlap");
  });

  it("includes closed historical terms in duplicate-date validation", () => {
    expect(() =>
      assertNoOverlappingTerms(
        { endDate: "2026-09-30", startDate: "2025-10-01" },
        [
          {
            $id: "closed-term",
            endDate: "2026-09-30",
            startDate: "2025-10-01",
          },
        ],
      ),
    ).toThrow("overlap");
  });

  it("treats closed terms as irreversible historical records", () => {
    expect(() => assertTermCanBeUpdated({ status: "CLOSED" })).toThrow(
      "cannot be changed",
    );
    expect(() => assertTermCanBeActivated({ status: "CLOSED" })).toThrow(
      "cannot be reactivated",
    );
    expect(() => assertTermCanBeUpdated({ status: "DRAFT" })).not.toThrow();
    expect(() => assertTermCanBeActivated({ status: "ACTIVE" })).not.toThrow();
  });

  it("repairs stale active settings and selects the newest valid active term", () => {
    const terms = [
      {
        $id: "older-active",
        active: true,
        status: "ACTIVE" as const,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        $id: "newer-active",
        active: true,
        status: "ACTIVE" as const,
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      {
        $id: "closed-term",
        active: false,
        status: "CLOSED" as const,
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ];

    expect(resolveActiveTermState(terms, "missing-term")).toEqual({
      activeTermId: "newer-active",
      duplicateActiveTermIds: ["older-active"],
      needsRepair: true,
      termRepairs: [
        {
          active: false,
          reason: "NON_SELECTED_ACTIVE_TERM_CLOSED",
          status: "CLOSED",
          termId: "older-active",
        },
      ],
    });
    expect(resolveActiveTermState(terms, "older-active")).toEqual({
      activeTermId: "older-active",
      duplicateActiveTermIds: ["newer-active"],
      needsRepair: true,
      termRepairs: [
        {
          active: false,
          reason: "NON_SELECTED_ACTIVE_TERM_CLOSED",
          status: "CLOSED",
          termId: "newer-active",
        },
      ],
    });
    expect(resolveActiveTermState([terms[2]], "closed-term")).toEqual({
      activeTermId: "",
      duplicateActiveTermIds: [],
      needsRepair: true,
      termRepairs: [],
    });
    expect(resolveActiveTermState([], "")).toEqual({
      activeTermId: "",
      duplicateActiveTermIds: [],
      needsRepair: false,
      termRepairs: [],
    });
    expect(resolveActiveTermState([], null)).toEqual({
      activeTermId: "",
      duplicateActiveTermIds: [],
      needsRepair: true,
      termRepairs: [],
    });
  });

  it("repairs contradictory active flags and ACTIVE statuses", () => {
    expect(
      resolveActiveTermState(
        [
          {
            $id: "draft-with-active-flag",
            active: true,
            status: "DRAFT",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        "",
      ),
    ).toEqual({
      activeTermId: "",
      duplicateActiveTermIds: [],
      needsRepair: true,
      termRepairs: [
        {
          active: false,
          reason: "DRAFT_ACTIVE_FLAG_CLEARED",
          status: "DRAFT",
          termId: "draft-with-active-flag",
        },
      ],
    });

    expect(
      resolveActiveTermState(
        [
          {
            $id: "inactive-active-status",
            active: false,
            status: "ACTIVE",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        "inactive-active-status",
      ),
    ).toEqual({
      activeTermId: "inactive-active-status",
      duplicateActiveTermIds: [],
      needsRepair: true,
      termRepairs: [
        {
          active: true,
          reason: "SELECTED_TERM_NORMALIZED",
          status: "ACTIVE",
          termId: "inactive-active-status",
        },
      ],
    });
  });

  it("checks Top Board exclusion active state", () => {
    expect(isActiveTopBoardExclusion({ active: true })).toBe(true);
    expect(isActiveTopBoardExclusion({ active: true, revokedAt: "2026-01-01" })).toBe(false);
    expect(isActiveTopBoardExclusion({ active: false })).toBe(false);
  });

  it("builds permission overview with current RBAC roles", () => {
    const overview = buildPermissionOverview("admin@example.com");

    expect(overview.adminEmail).toBe("admin@example.com");
    expect(overview.adminSource).toBe("ADMIN_EMAIL");
    expect(overview.sbRoles.map((role) => role.role)).toEqual([
      "ExCom",
      "SB Lead",
      "SB Member",
    ]);
    expect(overview.eventRoles.map((role) => role.role)).toEqual([
      "Chair",
      "Vice Chair",
      "Committee Lead",
      "Committee Member",
    ]);
  });
});
