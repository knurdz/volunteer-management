"use client";

import { useActionState } from "react";
import { BellPlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_TYPES } from "@/features/notifications/types";
import {
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

export function AdminNotificationForm({
  profiles,
}: {
  profiles: Profile[];
}) {
  const [state, formAction, pending] = useActionState(
    sendAdminNotification,
    initialState,
  );
  const activeProfiles = profiles.filter((profile) => profile.status === "ACTIVE");

  return (
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
      </section>

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

      <label className="flex items-start gap-3 rounded-md border border-border bg-surface-subtle p-3 text-sm text-text-secondary">
        <input
          className="mt-1 size-4 rounded border-border"
          name="enableEmail"
          type="checkbox"
        />
        <span>
          <span className="block font-medium text-text-primary">
            Send email too
          </span>
          <span>
            Enables email notifications for this recipient and notification type before sending.
          </span>
        </span>
      </label>

      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
              : "rounded-md border border-success/25 bg-success-soft px-3 py-2 text-sm text-success"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button disabled={pending || activeProfiles.length === 0} type="submit" variant="primary">
        {pending ? (
          <BellPlus className="size-4" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        {pending ? "Sending" : "Send Notification"}
      </Button>
    </form>
  );
}
