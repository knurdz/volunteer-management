import { z } from "zod";
import { EVENT_ROLES, EVENT_YEAR_MAX, EVENT_YEAR_MIN, IEEE_TERMS } from "@/lib/config";
import type { EventRole } from "@/features/access-control/types";

export type { EventRole };

export const EVENT_STATUSES = [
  "draft",
  "planning",
  "published",
  "ongoing",
  "pending_conclusion",
  "closed",
] as const;

export const CONCLUSION_STATUSES = [
  "not_submitted",
  "submitted",
  "approved",
  "rejected",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];
export type ConclusionStatus = (typeof CONCLUSION_STATUSES)[number];
export type IeeeTerm = (typeof IEEE_TERMS)[number];

export type Event = {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  title: string;
  reference: string;
  description?: string;
  term: IeeeTerm;
  year: number;
  start_date: string;
  end_date?: string;
  status: EventStatus;
  conclusion_status: ConclusionStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Committee = {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  event_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type CommitteeMember = {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  committee_id: string;
  user_id: string;
  added_by: string;
  added_at: string;
};

export type EventWithRoleAssignments = Event & {
  roleAssignments: import("@/features/access-control/types").EventRoleAssignment[];
};

export type CreateEventInput = {
  title: string;
  reference: string;
  description?: string;
  term: IeeeTerm;
  year: number;
  start_date: string;
  end_date?: string;
};

export type UpdateEventInput = Partial<CreateEventInput>;

export type AssignEventRoleInput = {
  event_id: string;
  user_id: string;
  role: EventRole;
  committee_name?: string;
};

export type CreateCommitteeInput = {
  event_id: string;
  name: string;
  description?: string;
};

export type AddCommitteeMemberInput = {
  user_id: string;
};

export type EventPermissions = {
  canEdit: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canAssignRoles: boolean;
  canManageCommittee: boolean;
  canSubmitConclusion: boolean;
  canApproveConclusion: boolean;
};

export const CONCLUSION_ACTIONS = ["submit", "approve", "reject"] as const;
export type ConclusionAction = (typeof CONCLUSION_ACTIONS)[number];

const dateRangeRefinement = {
  check: (data: { start_date?: string; end_date?: string }) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) > new Date(data.start_date);
    }

    return true;
  },
  message: "end_date must be after start_date" as const,
  path: ["end_date"] as const,
};

const optionalDescription = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => value || undefined);

const optionalEndDate = z
  .string()
  .datetime({ offset: true })
  .optional()
  .transform((value) => value || undefined);

const createEventFields = z.object({
  title: z.string().trim().min(1).max(200),
  reference: z.string().trim().min(1).max(100),
  description: optionalDescription,
  term: z.enum(IEEE_TERMS),
  year: z.number().int().min(EVENT_YEAR_MIN).max(EVENT_YEAR_MAX),
  start_date: z.string().datetime({ offset: true }),
  end_date: optionalEndDate,
});

export const CreateEventInputSchema = createEventFields
  .refine(dateRangeRefinement.check, {
    message: dateRangeRefinement.message,
    path: [...dateRangeRefinement.path],
  }) satisfies z.ZodType<CreateEventInput>;

export const UpdateEventInputSchema = createEventFields
  .partial()
  .refine(dateRangeRefinement.check, {
    message: dateRangeRefinement.message,
    path: [...dateRangeRefinement.path],
  }) satisfies z.ZodType<UpdateEventInput>;

export const AssignEventRoleInputSchema = z.object({
  event_id: z.string().trim().min(1).max(64),
  user_id: z.string().trim().min(1).max(64),
  role: z.enum(EVENT_ROLES),
  committee_name: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
}) satisfies z.ZodType<AssignEventRoleInput>;

export const CreateCommitteeInputSchema = z.object({
  event_id: z.string().trim().min(1).max(64),
  name: z
    .string()
    .trim()
    .min(2, "Committee name must be at least 2 characters")
    .max(100, "Committee name must be at most 100 characters"),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
}) satisfies z.ZodType<CreateCommitteeInput>;

export const AddCommitteeMemberInputSchema = z.object({
  user_id: z.string().trim().min(1).max(64),
}) satisfies z.ZodType<AddCommitteeMemberInput>;

export const ConclusionActionSchema = z.object({
  action: z.enum(CONCLUSION_ACTIONS),
});
