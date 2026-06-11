"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Loader2,
  Mail,
  MonitorCheck,
  Save,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NOTIFICATION_TYPES,
  type NotificationPreference,
  type NotificationType,
} from "@/features/notifications/types";

type NotificationPreferenceDraft = Pick<
  NotificationPreference,
  "emailEnabled" | "inAppEnabled" | "typePreferences"
>;

export function NotificationPreferencesForm({
  initialPreference,
}: {
  initialPreference: NotificationPreference;
}) {
  const [draft, setDraft] = useState<NotificationPreferenceDraft>({
    emailEnabled: initialPreference.emailEnabled,
    inAppEnabled: initialPreference.inAppEnabled,
    typePreferences: initialPreference.typePreferences,
  });
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"error" | "idle" | "success">("idle");
  const [isSaving, setIsSaving] = useState(false);
  const rows = useMemo(
    () =>
      NOTIFICATION_TYPES.map((type) => ({
        emailEnabled: draft.typePreferences[type]?.emailEnabled ?? draft.emailEnabled,
        inAppEnabled: draft.typePreferences[type]?.inAppEnabled ?? draft.inAppEnabled,
        label: type.replaceAll("_", " "),
        type,
      })),
    [draft],
  );

  async function savePreferences() {
    setIsSaving(true);
    setMessage("");
    setStatus("idle");

    try {
      const response = await fetch("/api/notifications/preferences", {
        body: JSON.stringify(draft),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json()) as {
        error?: string;
        preference?: NotificationPreference;
      };

      if (!response.ok || !payload.preference) {
        setMessage(payload.error ?? "Could not save preferences.");
        setStatus("error");
        return;
      }

      setDraft({
        emailEnabled: payload.preference.emailEnabled,
        inAppEnabled: payload.preference.inAppEnabled,
        typePreferences: payload.preference.typePreferences,
      });
      setMessage("Notification preferences saved.");
      setStatus("success");
    } finally {
      setIsSaving(false);
    }
  }

  function setGlobal(field: "emailEnabled" | "inAppEnabled", checked: boolean) {
    setDraft((current) => ({
      ...current,
      [field]: checked,
    }));
  }

  function setTypePreference(
    type: NotificationType,
    field: "emailEnabled" | "inAppEnabled",
    checked: boolean,
  ) {
    setDraft((current) => ({
      ...current,
      typePreferences: {
        ...current.typePreferences,
        [type]: {
          ...current.typePreferences[type],
          [field]: checked,
        },
      },
    }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ChannelToggle
          checked={draft.inAppEnabled}
          icon={MonitorCheck}
          label="In-app"
          onChange={(checked) => setGlobal("inAppEnabled", checked)}
        />
        <ChannelToggle
          checked={draft.emailEnabled}
          icon={Mail}
          label="Email"
          onChange={(checked) => setGlobal("emailEnabled", checked)}
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-[520px] w-full divide-y divide-border text-left text-sm">
          <thead className="bg-surface-subtle text-text-secondary">
            <tr>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">In-app</th>
              <th className="px-3 py-2 font-semibold">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.type}>
                <td className="px-3 py-2 font-medium capitalize text-text-primary">
                  {row.label}
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`${row.label} in-app notifications`}
                    checked={row.inAppEnabled}
                    className="size-4 rounded border-border"
                    onChange={(event) =>
                      setTypePreference(row.type, "inAppEnabled", event.target.checked)
                    }
                    type="checkbox"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`${row.label} email notifications`}
                    checked={row.emailEnabled}
                    className="size-4 rounded border-border"
                    onChange={(event) =>
                      setTypePreference(row.type, "emailEnabled", event.target.checked)
                    }
                    type="checkbox"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {message ? (
          <p
            className={
              status === "error"
                ? "text-sm font-medium text-danger"
                : "text-sm font-medium text-success"
            }
          >
            {message}
          </p>
        ) : (
          <span className="text-sm text-text-muted">
            <Bell className="mr-1 inline size-4 align-[-3px]" aria-hidden="true" />
            Current account only
          </span>
        )}
        <Button disabled={isSaving} onClick={() => void savePreferences()} type="button">
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {isSaving ? "Saving" : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}

function ChannelToggle({
  checked,
  icon: Icon,
  label,
  onChange,
}: {
  checked: boolean;
  icon: LucideIcon;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-text-primary">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {label}
      </span>
      <input
        checked={checked}
        className="size-4 rounded border-border"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}
