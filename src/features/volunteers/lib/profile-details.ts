import { z } from "zod";

function isLinkedInUrl(value: string) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com"))
    );
  } catch {
    return false;
  }
}

export const volunteerProfileDetailsSchema = z.object({
  batchYear: z.string().trim().min(1, "Batch/year is required.").max(40),
  bio: z.string().trim().max(1200).optional().default(""),
  department: z.string().trim().min(1, "Department is required.").max(120),
  faculty: z.string().trim().min(1, "Faculty is required.").max(120),
  headline: z.string().trim().max(160).optional().default(""),
  ieeeMembership: z.string().trim().min(1, "IEEE membership is required.").max(120),
  linkedinUrl: z
    .string()
    .trim()
    .max(240)
    .optional()
    .default("")
    .refine(isLinkedInUrl, {
      message: "LinkedIn URL must be an https://linkedin.com URL.",
    }),
  skills: z.string().trim().max(500).optional().default(""),
  universityIndex: z.string().trim().min(1, "University index is required.").max(40),
});

export type VolunteerProfileDetailsInput = z.infer<typeof volunteerProfileDetailsSchema>;
