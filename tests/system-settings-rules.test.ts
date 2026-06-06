import { describe, expect, it } from "vitest";
import {
  assertNoOverlappingTerms,
  assertValidTermDates,
  buildPermissionOverview,
  dateRangesOverlap,
  formatTermLabel,
  getSuggestedTermRange,
  isActiveTopBoardExclusion,
} from "../src/features/system-settings/lib/rules";

describe("system settings rules", () => {
  it("formats IEEE term labels from the start year", () => {
    expect(formatTermLabel("2025-10-01")).toBe("2025/26");
    expect(formatTermLabel("2024-08-16")).toBe("2024/25");
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
        { endDate: "2026-12-31", startDate: "2026-08-01", status: "DRAFT" },
        [
          {
            $id: "term-1",
            endDate: "2026-09-30",
            startDate: "2025-10-01",
            status: "ACTIVE",
          },
        ],
      ),
    ).toThrow("overlap");
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
