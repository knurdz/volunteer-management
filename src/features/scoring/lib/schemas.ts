import { z } from "zod";
import { EVENT_ROLES } from "@/lib/config";

// ISO Date validator
export const IsoDateSchema = z.string().datetime();

// Term validator
export const TermSchema = z.string().regex(/^\d{4}(\/\d{4})?$/);

// Year validator
export const YearSchema = z.number().int().min(1900).max(2100);

// Month validator
export const MonthSchema = z.number().int().min(1).max(12);

// Participation record schema
export const ParticipationRecordSchema = z.object({
  userId: z.string().min(1),
  eventId: z.string().min(1),
  role: z.enum(EVENT_ROLES),
  status: z.enum(["attended", "absent", "excused"]),
});

// Grade request schema
export const GradeRequestSchema = z.object({
  eventId: z.string().min(1),
  targetUserId: z.string().min(1),
  gradeValue: z.number().int().min(0).max(10),
});

// Admin override schema
export const AdminGradeOverrideSchema = z.object({
  gradeReviewId: z.string().min(1),
  newGradeValue: z.number().int().min(0).max(10),
  reason: z.string().optional(),
});
