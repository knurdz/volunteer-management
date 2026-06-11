"use client";

import { useActionState, useMemo, useState } from "react";
import { BellPlus, Send, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NOTIFICATION_TYPES } from "@/features/notifications/types";
import {
  sendAdminBulkNotification,
  sendAdminNotification,
  type AdminNotificationFormState,
} from "@/features/notifications/actions/send-admin-notification";
import type { Profile } from "@/features/access-control/types";

const initialState: AdminNotificationFormState = {
  message: "",
  status: "idle",
};

const inputClasses =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary";

export type NotificationEventOption = {
  eventId: string;
  eventTitle: string;
  recipientCount: number;
};

type SendMode = "event" | "single" | "uom_verified";

export function AdminNotificationForm({
  eventOptions,
  profiles,
}: {
  eventOptions: NotificationEventOption[];
  profiles: Profile[];
}) {
  const [state, formAction, pending] = useActionState(
    sendAdminNotification,
    initialState,
  );
  const [bulkState, bulkFormAction, bulkPending] = useActionState(
    sendAdminBulkNotification,
    initialState,
  );
  const [mode, setMode] = useState<SendMode>("single");
  const activeProfiles = profiles.filter((profile) => profile.status === "ACTIVE");
  const uomVerifiedCount = useMemo(
    () =>
      profiles.filter(
        (profile) => profile.status === "ACTIVE" && profile.uomVerified,
      ).length,
    [profiles],
  );

  return (
    <div className="space-y-5">
      <div className="inline-flex w-full flex-col rounded-md border border-border bg-surface p-1 sm:w-fit sm:flex-row">
        <ModeButton active={mode === "single"} onClick={() => setMode("single")}>
          One user
        </ModeButton>
        <ModeButton
          active={mode === "uom_verified"}
          onClick={() => setMode("uom_verified")}
        >
          UoM verified
        </ModeButton>
        <ModeButton active={mode === "event"} onClick={() => setMode("event")}>
          Event users
        </ModeButton>
      </div>

      {mode === "single" ? (
        <form action={formAction} className="space-y-5">
          <section className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-medium text-text-secondary">
              Recipient
              <select
                className={`${inputClasses} mt-1`}
                name="recipientUserId"
                required
              >
                <option value="">Select recipient</option>
                {activeProfiles.map((profile) => (
                  <option key={profile.authUserId} value={profile.authUserId}>
                    {profile.name || profile.googleEmail} - {profile.authUserId}
                  </option>
                ))}
              </select>
            </label>

            <NotificationTypeSelect />
          </section>

          <MessageFields />

          <ActionNotice state={state} />

          <Button
            disabled={pending || activeProfiles.length === 0}
            type="submit"
            variant="primary"
          >
            {pending ? (
              <BellPlus className="size-4" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            {pending ? "Sending" : "Send Notification"}
          </Button>
        </form>
      ) : (
        <form action={bulkFormAction} className="space-y-5">
          <input name="recipientScope" type="hidden" value={mode} />

          {mode === "uom_verified" ? (
            <BulkSummary
              description="Sends the same email-backed notification to every active user with verified UoM email."
              label="UoM verified recipients"
              value={uomVerifiedCount}
            />
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              <label className="block text-sm font-medium text-text-secondary">
                Event
                <select
                  className={`${inputClasses} mt-1`}
                  name="eventId"
                  required
                >
                  <option value="">Select event</option>
                  {eventOptions.map((event) => (
                    <option key={event.eventId} value={event.eventId}>
                      {event.eventTitle} - {event.recipientCount} recipient
                      {event.recipientCount === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>

              <NotificationTypeSelect />
            </section>
          )}

          {mode === "uom_verified" ? <NotificationTypeSelect /> : null}

          <MessageFields />

          <p className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-secondary">
            Bulk sends create notifications for each recipient. Email delivery follows
            saved recipient preferences.
          </p>

          <ActionNotice state={bulkState} />

          <Button
            disabled={
              bulkPending ||
              (mode === "uom_verified" && uomVerifiedCount === 0) ||
              (mode === "event" && eventOptions.length === 0)
            }
            type="submit"
            variant="primary"
          >
            {bulkPending ? (
              <UsersRound className="size-4" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            {bulkPending ? "Sending" : "Send Bulk Notification"}
          </Button>
        </form>
      )}
    </div>
  );
}

function NotificationTypeSelect() {
  return (
    <label className="block text-sm font-medium text-text-secondary">
      Type
      <select className={`${inputClasses} mt-1`} name="type" defaultValue="system">
        {NOTIFICATION_TYPES.map((type) => (
          <option key={type} value={type}>
            {type.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function MessageFields() {
  return (
    <>
      <label className="block text-sm font-medium text-text-secondary">
        Title
        <input
          className={`${inputClasses} mt-1`}
          maxLength={160}
          name="title"
          placeholder="Test notification"
          required
        />
      </label>

      <label className="block text-sm font-medium text-text-secondary">
        Message
        <textarea
          className="mt-1 min-h-28 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary"
          maxLength={1000}
          name="message"
          placeholder="Write the message that should appear in-app and in email."
          required
        />
      </label>

      <label className="block text-sm font-medium text-text-secondary">
        Link
        <input
          className={`${inputClasses} mt-1`}
          maxLength={512}
          name="linkHref"
          placeholder="/dashboard"
        />
      </label>
    </>
  );
}

function ActionNotice({ state }: { state: AdminNotificationFormState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={
        state.status === "error"
          ? "rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
          : "rounded-md border border-success/25 bg-success-soft px-3 py-2 text-sm text-success"
      }
    >
      {state.message}
    </p>
  );
}

function BulkSummary({
  description,
  label,
  value,
}: {
  description: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">{label}</p>
          <p className="mt-1 text-sm leading-5 text-text-secondary">{description}</p>
        </div>
        <span className="text-2xl font-semibold text-primary">{value}</span>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "h-9 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-surface-muted text-primary"
          : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
