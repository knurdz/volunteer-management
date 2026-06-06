import { z } from "zod";

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

export const EVENT_COMMITTEE_ROLES = [
  "chair",
  "vice_chair",
  "committee_lead",
  "committee_member",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];
export type ConclusionStatus = (typeof CONCLUSION_STATUSES)[number];
export type EventRole = (typeof EVENT_COMMITTEE_ROLES)[number];

export type Event = {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  title: string;
  reference: string;
  description?: string;
  term: string;
  year: number;
  start_date: string;
  end_date?: string;
  status: EventStatus;
  conclusion_status: ConclusionStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type EventCommittee = {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  event_id: string;
  user_id: string;
  role: EventRole;
  committee_name?: string;
  display_role?: string;
  assigned_by: string;
  assigned_at: string;
  is_active: boolean;
};

export type EventWithCommittees = Event & {
  committees: EventCommittee[];
};

export type CreateEventInput = {
  title: string;
  reference: string;
  description?: string;
  term: string;
  year: number;
  start_date: string;
  end_date?: string;
};

export type UpdateEventInput = Partial<CreateEventInput> & {
  status?: EventStatus;
};

export type AssignEventRoleInput = {
  event_id: string;
  user_id: string;
  role: EventRole;
  committee_name?: string;
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

export const CreateEventInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  reference: z.string().trim().min(1).max(100),
  description: optionalDescription,
  term: z.string().trim().min(1).max(20),
  year: z.number().int(),
  start_date: z.string().datetime({ offset: true }),
  end_date: optionalEndDate,
}) satisfies z.ZodType<CreateEventInput>;

export const UpdateEventInputSchema = CreateEventInputSchema.partial().extend({
  status: z.enum(EVENT_STATUSES).optional(),
}) satisfies z.ZodType<UpdateEventInput>;

export const AssignEventRoleInputSchema = z.object({
  event_id: z.string().trim().min(1).max(64),
  user_id: z.string().trim().min(1).max(64),
  role: z.enum(EVENT_COMMITTEE_ROLES),
  committee_name: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
}) satisfies z.ZodType<AssignEventRoleInput>;
