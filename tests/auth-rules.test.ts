import { describe, expect, it } from "vitest";
import {
  canVolunteer,
  hasSbRole,
  isAdminEmail,
  normalizeUomEmail,
} from "../src/lib/auth/rules";

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

  it("normalizes and validates UoM email", () => {
    expect(normalizeUomEmail("User@UOM.LK")).toBe("user@uom.lk");
    expect(() => normalizeUomEmail("user@example.com")).toThrow("@uom.lk");
  });
});
