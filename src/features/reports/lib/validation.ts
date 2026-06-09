import { z } from "zod";

export const draftContentSchema = z.object({
  objectives: z.string().trim().max(4000).optional(),
  outcomes: z.string().trim().max(4000).optional(),
  challenges: z.string().trim().max(4000).optional(),
  recommendations: z.string().trim().max(4000).optional(),
  attendanceNotes: z.string().trim().max(2000).optional(),
});

export const conclusionContentSchema = z.object({
  objectives: z.string().trim().min(1, "Objectives are required.").max(4000),
  outcomes: z.string().trim().min(1, "Outcomes are required.").max(4000),
  challenges: z.string().trim().max(4000),
  recommendations: z.string().trim().min(1, "Recommendations are required.").max(4000),
  attendanceNotes: z.string().trim().max(2000),
});

export const createConclusionReportSchema = z.object({
  content: draftContentSchema.optional(),
  eventId: z.string().trim().min(1).max(128),
});

export const updateConclusionReportSchema = z.object({
  content: draftContentSchema.optional(),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
});

export const adminReopenConclusionReportSchema = z.object({
  status: z.literal("DRAFT"),
});

export const approveConclusionReportSchema = z.object({
  reviewNote: z.string().trim().max(1000).optional(),
  status: z.enum(["APPROVED", "REJECTED"]),
});

export type DraftContentInput = z.infer<typeof draftContentSchema>;
export type CreateConclusionReportInput = z.infer<typeof createConclusionReportSchema>;
export type UpdateConclusionReportInput = z.infer<typeof updateConclusionReportSchema>;
export type AdminReopenConclusionReportInput = z.infer<typeof adminReopenConclusionReportSchema>;
export type ApproveConclusionReportInput = z.infer<typeof approveConclusionReportSchema>;
