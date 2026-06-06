import { z } from "zod";

export const conclusionContentSchema = z.object({
  objectives: z.string().trim().min(1, "Objectives are required.").max(4000),
  outcomes: z.string().trim().min(1, "Outcomes are required.").max(4000),
  challenges: z.string().trim().max(4000),
  recommendations: z.string().trim().min(1, "Recommendations are required.").max(4000),
  attendanceNotes: z.string().trim().max(2000),
});

export const createConclusionReportSchema = z.object({
  content: conclusionContentSchema,
  eventId: z.string().trim().min(1).max(128),
  eventTitle: z.string().trim().min(1).max(160),
});

export const updateConclusionReportSchema = z.object({
  content: conclusionContentSchema.partial().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
});

export const approveConclusionReportSchema = z.object({
  reviewNote: z.string().trim().max(1000).optional(),
  status: z.enum(["APPROVED", "REJECTED"]),
});

export type CreateConclusionReportInput = z.infer<typeof createConclusionReportSchema>;
export type UpdateConclusionReportInput = z.infer<typeof updateConclusionReportSchema>;
export type ApproveConclusionReportInput = z.infer<typeof approveConclusionReportSchema>;
