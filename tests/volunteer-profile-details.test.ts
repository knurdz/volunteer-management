import { describe, expect, it } from "vitest";
import { volunteerProfileDetailsSchema } from "../src/features/volunteers/lib/profile-details";

describe("volunteer profile details", () => {
  it("trims profile details and defaults missing fields", () => {
    const result = volunteerProfileDetailsSchema.parse({
      batchYear: "  2024  ",
      department: "  Computer Science  ",
      faculty: "  Engineering  ",
      headline: "  Event volunteer  ",
      ieeeMembership: "  Student Member  ",
      universityIndex: "  220000A  ",
    });

    expect(result).toEqual({
      batchYear: "2024",
      bio: "",
      department: "Computer Science",
      faculty: "Engineering",
      headline: "Event volunteer",
      ieeeMembership: "Student Member",
      linkedinUrl: "",
      skills: "",
      universityIndex: "220000A",
    });
  });

  it("requires LinkedIn URLs when a URL is provided", () => {
    expect(() =>
      volunteerProfileDetailsSchema.parse({
        batchYear: "2024",
        department: "Computer Science",
        faculty: "Engineering",
        ieeeMembership: "Student Member",
        linkedinUrl: "http://linkedin.com/in/test",
        universityIndex: "220000A",
      }),
    ).toThrow("linkedin.com");

    expect(() =>
      volunteerProfileDetailsSchema.parse({
        batchYear: "2024",
        department: "Computer Science",
        faculty: "Engineering",
        ieeeMembership: "Student Member",
        linkedinUrl: "https://example.com/in/test",
        universityIndex: "220000A",
      }),
    ).toThrow("linkedin.com");

    expect(
      volunteerProfileDetailsSchema.parse({
        batchYear: "2024",
        department: "Computer Science",
        faculty: "Engineering",
        ieeeMembership: "Student Member",
        linkedinUrl: "https://www.linkedin.com/in/test",
        universityIndex: "220000A",
      }).linkedinUrl,
    ).toBe("https://www.linkedin.com/in/test");
  });

  it("requires academic identity fields", () => {
    expect(() =>
      volunteerProfileDetailsSchema.parse({
        batchYear: "",
        department: "Computer Science",
        faculty: "Engineering",
        ieeeMembership: "Student Member",
        universityIndex: "220000A",
      }),
    ).toThrow("Batch/year");
  });
});
