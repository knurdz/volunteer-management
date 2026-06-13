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
import type { EventRoleAssignment } from "@/features/access-control/types";
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
import { CommitteeManagement } from "@/features/events/components/CommitteeManagement";
import { AssignRoleModal } from "@/features/events/components/AssignRoleModal";
import { canRemoveCommitteeRole } from "@/features/events/lib/committee-permissions";
import {
  formatConclusionStatus,
  formatEventDate,
  formatEventStatus,
  getAvailableStatusTransitions,
  getConclusionStatusBadgeTone,
  getEventStatusBadgeClassName,
  getEventStatusBadgeTone,
} from "@/features/events/lib/event-ui";
import type { Committee, CommitteeMember, Event, EventPermissions, EventRole, EventStatus } from "@/features/events/types";
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

function formatAssignmentRole(assignment: EventRoleAssignment) {
  if (assignment.role === "Chair" && (assignment.eventChairCount ?? 0) > 1) {
    return "Co-chair";
  }

  return assignment.role;
}

export function EventDetail({
  currentUserId,
  initialAssignments,
  initialCommittees,
  initialEvent,
  initialPermissions,
  isAdmin,
  userEventRole,
}: Readonly<{
  currentUserId: string;
  initialAssignments: EventRoleAssignment[];
  initialCommittees: Array<Committee & { members: CommitteeMember[] }>;
  initialEvent: Event;
  initialPermissions: EventPermissions;
  isAdmin: boolean;
  userEventRole: EventRole | null;
}>) {
  const router = useRouter();
  const [event, setEvent] = useState(initialEvent);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [permissions] = useState(initialPermissions);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | "">("");
  const [removeTarget, setRemoveTarget] = useState<EventRoleAssignment | null>(null);

  const refreshAssignments = useCallback(async () => {
    const response = await fetch(`/api/events/${event.$id}/roles`);
    const payload = await response.json();

    if (response.ok) {
      setAssignments(payload.assignments ?? []);
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
      const response = await fetch(`/api/events/${event.$id}/conclude`, {
        body: JSON.stringify({ action: "submit" }),
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

  async function handleConclusionDecision(decision: "approve" | "reject") {
    setPendingAction(decision);
    setError("");
    setMessage(decision === "approve" ? "Approving conclusion..." : "Rejecting conclusion...");

    try {
      const response = await fetch(`/api/events/${event.$id}/conclude`, {
        body: JSON.stringify({ action: decision }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not process conclusion decision.");
        setMessage("");
        return;
      }

      setEvent(payload.event);
      setMessage(
        decision === "approve" ? "Conclusion approved." : "Conclusion rejected.",
      );
      router.refresh();
    } catch {
      setError("Could not process conclusion decision.");
      setMessage("");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemoveMember(assignment: EventRoleAssignment) {
    setPendingAction(assignment.$id);
    setError("");

    try {
      const response = await fetch(
        `/api/events/${event.$id}/roles/${assignment.$id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? "Could not remove committee member.");
        return;
      }

      await refreshAssignments();
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
    (isAdmin || userEventRole === "Chair") && statusTransitions.length > 0;
  const currentStatusIndex = EVENT_STATUSES.indexOf(event.status);
  const canSubmitConclusion =
    permissions.canSubmitConclusion &&
    event.status === "ongoing" &&
    (event.conclusion_status === "not_submitted" || event.conclusion_status === "rejected");
  const canDecideConclusion =
    permissions.canApproveConclusion && event.conclusion_status === "submitted";

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

      <CommitteeManagement
        canManage={permissions.canManageCommittee}
        eventId={event.$id}
        initialCommittees={initialCommittees}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-primary" aria-hidden="true" />
                Role Assignments
              </CardTitle>
              <CardDescription>Active event role assignments.</CardDescription>
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
          {assignments.length > 0 ? (
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
                  {assignments.map((assignment) => {
                    const canRemove = canRemoveCommitteeRole({
                      actorEventRole: userEventRole,
                      actorUserId: currentUserId,
                      isAdmin,
                      targetAssignment: assignment,
                    });

                    return (
                      <tr key={assignment.$id}>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-text-primary">{assignment.userId}</p>
                          <p className="mt-1 text-xs text-text-muted">
                            User display lookup pending platform update
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone="primary">{formatAssignmentRole(assignment)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {assignment.committeeName || "Event-level"}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {formatEventDate(assignment.assignedAt)}
                        </td>
                        {permissions.canAssignRoles ? (
                          <td className="px-4 py-3">
                            {canRemove ? (
                              <Button
                                disabled={pendingAction === assignment.$id}
                                onClick={() => setRemoveTarget(assignment)}
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
            {canSubmitConclusion ? (
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

            {canDecideConclusion ? (
              <>
                <Button
                  disabled={pendingAction === "approve"}
                  onClick={() => handleConclusionDecision("approve")}
                  type="button"
                  variant="primary"
                >
                  {pendingAction === "approve" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Approving...
                    </>
                  ) : (
                    "Approve"
                  )}
                </Button>
                <Button
                  disabled={pendingAction === "reject"}
                  onClick={() => handleConclusionDecision("reject")}
                  type="button"
                  variant="ghost"
                >
                  {pendingAction === "reject" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Rejecting...
                    </>
                  ) : (
                    "Reject"
                  )}
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
          committeeNames={initialCommittees.map((committee) => committee.name)}
          currentUserIsAdmin={isAdmin}
          eventId={event.$id}
          onClose={() => setShowAssignModal(false)}
          onSuccess={refreshAssignments}
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
          description={`Remove ${formatAssignmentRole(removeTarget)} from this event committee?`}
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
