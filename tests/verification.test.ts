import { describe, expect, it } from "vitest";
import {
  createCodeHash,
  createVerificationExpiry,
  hasAttemptsRemaining,
  isVerificationExpired,
} from "../src/features/access-control/lib/verification";

describe("verification rules", () => {
  it("hashes code inputs deterministically", () => {
    const input = {
      code: "123456",
      pepper: "secret",
      uomEmail: "user@uom.lk",
      userId: "user-1",
    };

    expect(createCodeHash(input)).toBe(createCodeHash(input));
    expect(createCodeHash({ ...input, code: "654321" })).not.toBe(createCodeHash(input));
  });

  it("creates a future expiry and detects expired codes", () => {
    const now = new Date("2026-06-01T10:00:00.000Z");
    const expiry = createVerificationExpiry(now);

    expect(isVerificationExpired(expiry, now)).toBe(false);
    expect(isVerificationExpired(expiry, new Date("2026-06-01T10:16:00.000Z"))).toBe(true);
  });

  it("limits verification attempts", () => {
    expect(hasAttemptsRemaining(0)).toBe(true);
    expect(hasAttemptsRemaining(4)).toBe(true);
    expect(hasAttemptsRemaining(5)).toBe(false);
  });
});
