"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardList,
  Loader2,
  Pencil,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AssignRoleModal } from "@/features/events/components/AssignRoleModal";
import { canRemoveCommitteeRole } from "@/features/events/lib/committee-permissions";
import {
  formatConclusionStatus,
  formatEventDate,
  formatEventRole,
  formatEventStatus,
  getAvailableStatusTransitions,
  getConclusionStatusBadgeTone,
  getEventStatusBadgeClassName,
  getEventStatusBadgeTone,
} from "@/features/events/lib/event-ui";
import type {
  Event,
  EventCommittee,
  EventPermissions,
  EventRole,
  EventStatus,
} from "@/features/events/types";
import { EVENT_STATUSES } from "@/features/events/types";
import { cn } from "@/lib/utils";

const LIFECYCLE_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  planning: "Planning",
  published: "Published",
  ongoing: "Ongoing",
  pending_conclusion: "Pending Conclusion",
  closed: "Closed",
};

export function EventDetail({
  currentUserId,
  initialCommittees,
  initialEvent,
  initialPermissions,
  isAdmin,
  userCommitteeRole,
}: Readonly<{
  currentUserId: string;
  initialCommittees: EventCommittee[];
  initialEvent: Event;
  initialPermissions: EventPermissions;
  isAdmin: boolean;
  userCommitteeRole: EventRole | null;
}>) {
  const router = useRouter();
  const [event, setEvent] = useState(initialEvent);
  const [committees, setCommittees] = useState(initialCommittees);
  const [permissions] = useState(initialPermissions);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | "">("");
  const [removeTarget, setRemoveTarget] = useState<EventCommittee | null>(null);

  const refreshCommittees = useCallback(async () => {
    const response = await fetch(`/api/events/${event.$id}/committees`);
    const payload = await response.json();

    if (response.ok) {
      setCommittees(payload.committees ?? []);
    }
  }, [event.$id]);

  async function handleStatusChange() {
    if (!selectedStatus) {
      return;
    }

    setPendingAction("status");
    setError("");
    setMessage("Updating event status...");

    try {
      const response = await fetch(`/api/events/${event.$id}/status`, {
        body: JSON.stringify({ status: selectedStatus }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not update event status.");
        setMessage("");
        return;
      }

      setEvent(payload.event);
      setMessage("Event status updated.");
      setSelectedStatus("");
      router.refresh();
    } catch {
      setError("Could not update event status.");
      setMessage("");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    setPendingAction("delete");
    setError("");

    try {
      const response = await fetch(`/api/events/${event.$id}`, { method: "DELETE" });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? "Could not delete event.");
        return;
      }

      router.push("/events");
      router.refresh();
    } catch {
      setError("Could not delete event.");
    } finally {
      setPendingAction(null);
      setShowDeleteConfirm(false);
    }
  }

  async function handleSubmitConclusion() {
    setPendingAction("conclusion");
    setError("");
    setMessage("Submitting conclusion...");

    try {
      const response = await fetch(`/api/events/${event.$id}/status`, {
        body: JSON.stringify({ status: "pending_conclusion" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not submit conclusion.");
        setMessage("");
        return;
      }

      setEvent(payload.event);
      setMessage("Event moved to pending conclusion.");
      router.refresh();
    } catch {
      setError("Could not submit conclusion.");
      setMessage("");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleConclusionDecision(decision: "approved" | "rejected") {
    setPendingAction(decision);
    setMessage(
      decision === "approved"
        ? "Conclusion approval is not yet available in this release."
        : "Conclusion rejection is not yet available in this release.",
    );
    setPendingAction(null);
  }

  async function handleRemoveMember(committee: EventCommittee) {
    setPendingAction(committee.$id);
    setError("");

    try {
      const response = await fetch(
        `/api/events/${event.$id}/committees/${committee.$id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? "Could not remove committee member.");
        return;
      }

      await refreshCommittees();
      setMessage("Committee member removed.");
      setRemoveTarget(null);
    } catch {
      setError("Could not remove committee member.");
    } finally {
      setPendingAction(null);
    }
  }

  const statusTransitions = getAvailableStatusTransitions(event.status, { isAdmin });
  const canChangeStatus =
    (isAdmin || userCommitteeRole === "chair") && statusTransitions.length > 0;
  const currentStatusIndex = EVENT_STATUSES.indexOf(event.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.title}
        description={`${event.reference} · ${event.term} · ${event.year}`}
        actions={
          <Link className={buttonClasses()} href="/events">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Events
          </Link>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge
                className={getEventStatusBadgeClassName(event.status)}
                tone={getEventStatusBadgeTone(event.status)}
              >
                {formatEventStatus(event.status)}
              </Badge>
              <Badge tone={getConclusionStatusBadgeTone(event.conclusion_status)}>
                {formatConclusionStatus(event.conclusion_status)}
              </Badge>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-secondary">Start date</dt>
                <dd className="font-medium text-text-primary">
                  {formatEventDate(event.start_date)}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">End date</dt>
                <dd className="font-medium text-text-primary">
                  {event.end_date ? formatEventDate(event.end_date) : "Not set"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            {permissions.canEdit ? (
              <Link className={buttonClasses()} href={`/events/${event.$id}/edit`}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Link>
            ) : null}
            {permissions.canDelete ? (
              <Button onClick={() => setShowDeleteConfirm(true)} type="button" variant="ghost">
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {canChangeStatus ? (
        <Card>
          <CardHeader>
            <CardTitle>Change Status</CardTitle>
            <CardDescription>
              Advance or adjust the event lifecycle according to your permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm font-medium text-text-secondary">
              New status
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                onChange={(changeEvent) =>
                  setSelectedStatus(changeEvent.target.value as EventStatus)
                }
                value={selectedStatus}
              >
                <option value="">Select status</option>
                {statusTransitions.map((status) => (
                  <option key={status} value={status}>
                    {formatEventStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!selectedStatus || pendingAction === "status"}
              onClick={handleStatusChange}
              type="button"
              variant="primary"
            >
              {pendingAction === "status" ? "Updating..." : "Update Status"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-text-secondary">
            {event.description?.trim() ? event.description : "No description provided."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
          <CardDescription>Event progression from draft through closure.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 md:grid-cols-6">
            {EVENT_STATUSES.map((status, index) => {
              const isComplete = index < currentStatusIndex;
              const isCurrent = status === event.status;

              return (
                <li
                  className={cn(
                    "rounded-md border px-3 py-3 text-center text-xs font-medium",
                    isCurrent
                      ? "border-primary/30 bg-primary-soft text-primary"
                      : isComplete
                        ? "border-success/25 bg-success-soft text-success"
                        : "border-border bg-surface-subtle text-text-muted",
                  )}
                  key={status}
                >
                  <span className="mb-2 flex justify-center">
                    {isComplete ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      <span className="size-4 rounded-full border border-current" />
                    )}
                  </span>
                  {LIFECYCLE_LABELS[status]}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-primary" aria-hidden="true" />
                Committee
              </CardTitle>
              <CardDescription>Active event committee assignments.</CardDescription>
            </div>
            {permissions.canAssignRoles ? (
              <Button onClick={() => setShowAssignModal(true)} type="button" variant="primary">
                <UserPlus className="size-4" aria-hidden="true" />
                Add Member
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {committees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] divide-y divide-border text-left text-sm">
                <thead className="text-text-secondary">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Member</th>
                    <th className="px-4 py-2 font-semibold">Role</th>
                    <th className="px-4 py-2 font-semibold">Committee</th>
                    <th className="px-4 py-2 font-semibold">Assigned</th>
                    {permissions.canAssignRoles ? (
                      <th className="px-4 py-2 font-semibold">Action</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {committees.map((committee) => {
                    const canRemove = canRemoveCommitteeRole({
                      actorCommitteeRole: userCommitteeRole,
                      actorUserId: currentUserId,
                      isAdmin,
                      targetCommittee: committee,
                    });

                    return (
                      <tr key={committee.$id}>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-text-primary">{committee.user_id}</p>
                          <p className="mt-1 text-xs text-text-muted">
                            User display lookup pending platform update
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone="primary">
                            {formatEventRole(committee.role, committee.display_role)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {committee.committee_name || "Event-level"}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {formatEventDate(committee.assigned_at)}
                        </td>
                        {permissions.canAssignRoles ? (
                          <td className="px-4 py-3">
                            {canRemove ? (
                              <Button
                                disabled={pendingAction === committee.$id}
                                onClick={() => setRemoveTarget(committee)}
                                type="button"
                                variant="ghost"
                              >
                                Remove
                              </Button>
                            ) : (
                              <span className="text-xs text-text-muted">—</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No committee members are assigned to this event.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" aria-hidden="true" />
            Conclusion Status
          </CardTitle>
          <CardDescription>Post-event conclusion workflow state.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge tone={getConclusionStatusBadgeTone(event.conclusion_status)}>
            {formatConclusionStatus(event.conclusion_status)}
          </Badge>

          <div className="flex flex-wrap gap-2">
            {permissions.canSubmitConclusion && event.status === "ongoing" ? (
              <Button
                disabled={pendingAction === "conclusion"}
                onClick={handleSubmitConclusion}
                type="button"
                variant="primary"
              >
                {pendingAction === "conclusion" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Submitting...
                  </>
                ) : (
                  "Submit Conclusion"
                )}
              </Button>
            ) : null}

            {permissions.canApproveConclusion && event.conclusion_status === "submitted" ? (
              <>
                <Button
                  disabled={pendingAction === "approved"}
                  onClick={() => handleConclusionDecision("approved")}
                  type="button"
                  variant="primary"
                >
                  Approve
                </Button>
                <Button
                  disabled={pendingAction === "rejected"}
                  onClick={() => handleConclusionDecision("rejected")}
                  type="button"
                  variant="ghost"
                >
                  Reject
                </Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-text-secondary">{message}</p> : null}
      {error ? (
        <p className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {showAssignModal ? (
        <AssignRoleModal
          currentUserIsAdmin={isAdmin}
          eventId={event.$id}
          onClose={() => setShowAssignModal(false)}
          onSuccess={refreshCommittees}
        />
      ) : null}

      {showDeleteConfirm ? (
        <ConfirmationDialog
          confirmLabel="Delete Event"
          description="This action permanently removes the event record."
          isBusy={pendingAction === "delete"}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Delete Event"
        />
      ) : null}

      {removeTarget ? (
        <ConfirmationDialog
          confirmLabel="Remove Member"
          description={`Remove ${formatEventRole(removeTarget.role, removeTarget.display_role)} from this event committee?`}
          isBusy={pendingAction === removeTarget.$id}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => handleRemoveMember(removeTarget)}
          title="Remove Committee Member"
        />
      ) : null}
    </div>
  );
}

function ConfirmationDialog({
  confirmLabel,
  description,
  isBusy,
  onCancel,
  onConfirm,
  title,
}: {
  confirmLabel: string;
  description: string;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-warning/25 bg-warning-soft text-warning">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-text-primary">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button disabled={isBusy} onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={onConfirm} type="button" variant="primary">
            {isBusy ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
