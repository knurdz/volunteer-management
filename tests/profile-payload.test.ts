import { describe, expect, it } from "vitest";
import { buildInitialProfilePayload } from "../src/features/access-control/lib/profile-payload";

describe("profile bootstrap payload", () => {
  it("omits optional Appwrite email and datetime fields until they have real values", () => {
    const payload = buildInitialProfilePayload(
      {
        email: "user@example.com",
        id: "user-1",
        name: "Test User",
      },
      "2026-06-01T10:00:00.000Z",
    );

    expect(payload).toEqual({
      authUserId: "user-1",
      googleEmail: "user@example.com",
      lastLoginAt: "2026-06-01T10:00:00.000Z",
      name: "Test User",
      status: "ACTIVE",
      uomVerified: false,
    });
    expect(payload).not.toHaveProperty("uomEmail");
    expect(payload).not.toHaveProperty("uomVerifiedAt");
  });
});
