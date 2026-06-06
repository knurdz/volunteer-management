import type { SafeJsonObject } from "@/lib/validation/safe-json";

export const FORM_CONNECTION_PROVIDERS = [
  "google_forms",
  "external_form_builder",
  "other",
] as const;

export const FORM_CONNECTION_PURPOSES = [
  "registration",
  "feedback",
  "attendance",
  "grading",
  "other",
] as const;

export const FORM_CONNECTION_STATUSES = [
  "active",
  "disabled",
  "archived",
] as const;

export type FormConnectionProvider = (typeof FORM_CONNECTION_PROVIDERS)[number];
export type FormConnectionPurpose = (typeof FORM_CONNECTION_PURPOSES)[number];
export type FormConnectionStatus = (typeof FORM_CONNECTION_STATUSES)[number];

export type FormConnection = {
  createdAt: string;
  createdBy: string;
  eventId: string;
  externalFormId?: string;
  formUrl?: string;
  id: string;
  metadata?: SafeJsonObject;
  provider: FormConnectionProvider;
  purpose: FormConnectionPurpose;
  status: FormConnectionStatus;
  title: string;
  updatedAt: string;
};

export type CreateFormConnectionInput = {
  eventId: string;
  externalFormId?: string;
  formUrl?: string;
  metadata?: SafeJsonObject;
  provider: FormConnectionProvider;
  purpose: FormConnectionPurpose;
  status?: FormConnectionStatus;
  title: string;
};
