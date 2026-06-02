import { describe, expect, it } from "vitest";
import {
  canVolunteer,
  getEventRoleDisplayName,
  getEventRoleWeight,
  hasEventRole,
  hasSbRole,
  isEventRole,
  isAdminEmail,
  normalizeEventRole,
  normalizeUomEmail,
  requiresCommitteeName,
} from "../src/features/access-control/lib/rules";

describe("auth rules", () => {
  it("matches the single Admin email case-insensitively", () => {
    expect(isAdminEmail("Admin@Example.com", "admin@example.com")).toBe(true);
    expect(isAdminEmail("other@example.com", "admin@example.com")).toBe(false);
  });

  it("requires active profile and UoM verification before volunteering", () => {
    expect(canVolunteer({ status: "ACTIVE", uomVerified: true })).toBe(true);
    expect(canVolunteer({ status: "ACTIVE", uomVerified: false })).toBe(false);
    expect(canVolunteer({ status: "DISABLED", uomVerified: true })).toBe(false);
  });

  it("lets Admin pass SB role checks and normal users match assigned roles", () => {
    expect(hasSbRole({ isAdmin: true, sbRoles: [] }, "ExCom")).toBe(true);
    expect(hasSbRole({ isAdmin: false, sbRoles: ["SB Lead"] }, "SB Lead")).toBe(true);
    expect(hasSbRole({ isAdmin: false, sbRoles: ["SB Member"] }, "ExCom")).toBe(false);
  });

  it("validates and ranks event-scoped roles", () => {
    expect(isEventRole("Chair")).toBe(true);
    expect(normalizeEventRole("Lead")).toBe("Committee Lead");
    expect(normalizeEventRole("OC Member")).toBe("Committee Member");
    expect(isEventRole("Co Chair")).toBe(false);
    expect(getEventRoleWeight("Chair")).toBeGreaterThan(
      getEventRoleWeight("Committee Lead"),
    );
    expect(requiresCommitteeName("Committee Lead")).toBe(true);
    expect(requiresCommitteeName("Vice Chair")).toBe(false);
  });

  it("displays chair-level roles as co-chair only when an event has multiple chairs", () => {
    expect(getEventRoleDisplayName("Chair", { chairCount: 1 })).toBe("Chair");
    expect(getEventRoleDisplayName("Chair", { chairCount: 2 })).toBe("Co-chair");
    expect(getEventRoleDisplayName("Vice Chair", { chairCount: 2 })).toBe("Vice Chair");
  });

  it("checks event role assignments by event reference and role", () => {
    const eventRoles = [
      {
        $id: "assignment-1",
        active: true,
        assignedAt: "2026-01-01T00:00:00.000Z",
        assignedBy: "admin",
        committeeName: "Program",
        eventId: "MoraForesight 4.0",
        eventTitle: "MoraForesight 4.0",
        role: "Committee Lead" as const,
        userId: "user-1",
      },
    ];

    expect(
      hasEventRole({ eventRoles, isAdmin: false }, "MoraForesight 4.0", "Committee Lead"),
    ).toBe(true);
    expect(hasEventRole({ eventRoles, isAdmin: false }, "MoraForesight 4.0", "Chair"))
      .toBe(false);
    expect(hasEventRole({ eventRoles: [], isAdmin: true }, "anything", "Chair"))
      .toBe(true);
  });

  it("normalizes and validates UoM email", () => {
    expect(normalizeUomEmail("User@UOM.LK")).toBe("user@uom.lk");
    expect(() => normalizeUomEmail("user@example.com")).toThrow("@uom.lk");
  });
});
