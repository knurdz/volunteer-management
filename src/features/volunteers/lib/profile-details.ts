import { z } from "zod";

export const volunteerProfileDetailsSchema = z.object({
  bio: z.string().trim().max(1200).optional().default(""),
  headline: z.string().trim().max(160).optional().default(""),
  linkedinUrl: z
    .string()
    .trim()
    .max(240)
    .optional()
    .default("")
    .refine((value) => !value || value.startsWith("https://"), {
      message: "LinkedIn URL must start with https://.",
    }),
  skills: z.string().trim().max(500).optional().default(""),
});

export type VolunteerProfileDetailsInput = z.infer<typeof volunteerProfileDetailsSchema>;
