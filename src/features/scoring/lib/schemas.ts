import { z } from "zod";

// Participation record schema
export const ParticipationRecordSchema = z.object({
  userId: z.string().min(1),
  eventId: z.string().min(1),
  role: z.string().min(1),
  status: z.enum(["attended", "absent", "excused"]),
});

// Grade request schema
export const GradeRequestSchema = z.object({
  eventId: z.string().min(1),
  targetUserId: z.string().min(1),
  gradeValue: z.number().min(0).max(100),
});

// Admin override schema
export const AdminGradeOverrideSchema = z.object({
  gradeReviewId: z.string().min(1),
  newGradeValue: z.number().min(0).max(100),
  reason: z.string().optional(),
});
