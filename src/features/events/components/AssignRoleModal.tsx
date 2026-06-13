"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eventInputClasses } from "@/features/events/lib/event-ui";
import { AssignEventRoleInputSchema, type EventRole } from "@/features/events/types";
import { cn } from "@/lib/utils";

const CHAIR_ASSIGNABLE_ROLES: EventRole[] = [
  "Vice Chair",
  "Committee Lead",
  "Committee Member",
];

const ADMIN_ASSIGNABLE_ROLES: EventRole[] = ["Chair", ...CHAIR_ASSIGNABLE_ROLES];

export function AssignRoleModal({
  committeeNames,
  currentUserIsAdmin,
  eventId,
  onClose,
  onSuccess,
}: Readonly<{
  committeeNames: string[];
  currentUserIsAdmin: boolean;
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
}>) {
  const availableRoles = currentUserIsAdmin
    ? ADMIN_ASSIGNABLE_ROLES
    : CHAIR_ASSIGNABLE_ROLES;
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<EventRole>(availableRoles[0]);
  const [committeeName, setCommitteeName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const committeeRequired = role === "Committee Lead" || role === "Committee Member";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      event_id: eventId,
      user_id: userId,
      role,
      committee_name: committeeName || undefined,
    };

    const parsed = AssignEventRoleInputSchema.safeParse(payload);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Validation failed.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/events/${eventId}/roles`, {
        body: JSON.stringify(parsed.data),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const responsePayload = await response.json();

      if (!response.ok) {
        setError(responsePayload.error ?? "Could not assign role.");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Could not assign role.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary-soft text-primary">
              <UserPlus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Assign Committee Role</h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Add a volunteer to this event committee.
              </p>
            </div>
          </div>
        </div>

        <form className="space-y-4 px-5 py-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-text-secondary" htmlFor="user_id">
            User ID
            <input
              className={cn(eventInputClasses, "mt-1")}
              id="user_id"
              onChange={(event) => setUserId(event.target.value)}
              placeholder="Appwrite user ID"
              required
              value={userId}
            />
          </label>
          <p className="text-xs leading-5 text-text-muted">
            Enter the volunteer&apos;s platform user ID. Full name and email search will be
            provided in a future platform update.
          </p>

          <label className="block text-sm font-medium text-text-secondary" htmlFor="role">
            Role
            <select
              className={cn(eventInputClasses, "mt-1")}
              id="role"
              onChange={(event) => setRole(event.target.value as EventRole)}
              value={role}
            >
              {availableRoles.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-text-secondary" htmlFor="committee_name">
            Committee
            {committeeRequired ? (
              <select
                className={cn(eventInputClasses, "mt-1")}
                id="committee_name"
                onChange={(event) => setCommitteeName(event.target.value)}
                required
                value={committeeName}
              >
                <option value="">Select committee</option>
                {committeeNames.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={cn(eventInputClasses, "mt-1")}
                disabled
                id="committee_name"
                placeholder="Not required"
                value=""
              />
            )}
          </label>

          {error ? (
            <p className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button disabled={submitting} onClick={onClose} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={submitting} type="submit" variant="primary">
              <UserPlus className="size-4" aria-hidden="true" />
              {submitting ? "Assigning..." : "Assign Role"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
