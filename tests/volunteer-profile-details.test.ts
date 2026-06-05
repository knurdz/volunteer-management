import { describe, expect, it } from "vitest";
import { volunteerProfileDetailsSchema } from "../src/features/volunteers/lib/profile-details";

describe("volunteer profile details", () => {
  it("trims profile details and defaults missing fields", () => {
    const result = volunteerProfileDetailsSchema.parse({
      headline: "  Event volunteer  ",
    });

    expect(result).toEqual({
      bio: "",
      headline: "Event volunteer",
      linkedinUrl: "",
      skills: "",
    });
  });

  it("requires secure LinkedIn URLs when a URL is provided", () => {
    expect(() =>
      volunteerProfileDetailsSchema.parse({
        linkedinUrl: "http://linkedin.com/in/test",
      }),
    ).toThrow("https://");
  });
});
