"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ClipboardCheck,
  RefreshCw,
  Search,
  ShieldMinus,
  ShieldPlus,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { EVENT_ROLES, SB_ROLES } from "@/lib/config";
import {
  getEventRoleDisplayName,
  normalizeEventReference,
  requiresCommitteeName,
} from "@/features/access-control/lib/rules";
import { cn } from "@/lib/utils";
import type {
  EventRole,
  EventRoleAssignment,
  Profile,
  SbRole,
} from "@/features/access-control/types";

type AdminUser = Profile & {
  eventRoles: EventRoleAssignment[];
  sbRoles: SbRole[];
};

type EventRoleFormState = {
  committeeName: string;
  eventId: string;
  eventTitle: string;
  role: EventRole;
  userId: string;
};

type Confirmation =
  | {
      kind: "sb-role";
      role: SbRole;
      userId: string;
      userName: string;
      variant: "assign" | "revoke";
    }
  | {
      kind: "event-role-assign";
      payload: EventRoleFormState;
      roleDisplayName: string;
      userName: string;
    }
  | {
      assignmentId: string;
      committeeName?: string;
      eventTitle: string;
      kind: "event-role-revoke";
      role: EventRole;
      roleDisplayName: string;
      userName: string;
    };

type PanelMode = "branch" | "events";
type NoticeStatus = "error" | "idle" | "success";

const inputClasses =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary";

export function AccessControlPanel({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<PanelMode>("branch");
  const [query, setQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [status, setStatus] = useState<NoticeStatus>("idle");
  const [users, setUsers] = useState(initialUsers);
  const [eventRoleForm, setEventRoleForm] = useState<EventRoleFormState>({
    committeeName: "",
    eventId: "",
    eventTitle: "",
    role: "Chair",
    userId: initialUsers.find((user) => user.uomVerified)?.authUserId ?? "",
  });

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return users;
    }

    return users.filter((user) =>
      [
        user.name,
        user.googleEmail,
        user.uomEmail,
        user.authUserId,
        ...user.eventRoles.map((assignment) => assignment.eventTitle),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [query, users]);

  const eventAssignments = useMemo(
    () =>
      users.flatMap((user) =>
        user.eventRoles.map((assignment) => ({
          ...assignment,
          userName: user.name || user.googleEmail,
          userEmail: user.googleEmail,
          userVerified: user.uomVerified,
        })),
      ),
    [users],
  );
  const filteredEventAssignments = useMemo(
    () =>
      filteredUsers.flatMap((user) =>
        user.eventRoles.map((assignment) => ({
          ...assignment,
          userName: user.name || user.googleEmail,
          userEmail: user.googleEmail,
          userVerified: user.uomVerified,
        })),
      ),
    [filteredUsers],
  );
  const eventChairCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const assignment of eventAssignments) {
      if (assignment.role !== "Chair") {
        continue;
      }

      const eventKey = normalizeEventReference(assignment.eventId).toLowerCase();
      counts.set(eventKey, (counts.get(eventKey) ?? 0) + 1);
    }

    return counts;
  }, [eventAssignments]);
  const verifiedUsers = useMemo(
    () => users.filter((user) => user.uomVerified),
    [users],
  );
  const selectedEventUserId =
    verifiedUsers.find((user) => user.authUserId === eventRoleForm.userId)?.authUserId ??
    verifiedUsers[0]?.authUserId ??
    "";

  const verifiedCount = users.filter((user) => user.uomVerified).length;
  const sbRoleAssignedCount = users.filter((user) => user.sbRoles.length > 0).length;
  const eventRoleAssignedCount = eventAssignments.length;
  const committeeRequired = requiresCommitteeName(eventRoleForm.role);

  async function refreshUsers(nextMessage = "User list refreshed.") {
    setStatus("idle");
    setMessage("Refreshing users...");
    const response = await fetch("/api/admin/users");
    const payload = await response.json();

    if (response.ok) {
      setUsers(payload.users);
      setStatus("success");
      setMessage(nextMessage);
      return;
    }

    setStatus("error");
    setMessage(payload.error ?? "Could not refresh users.");
  }

  function requestSbRoleChange({
    role,
    userId,
    userName,
    variant,
  }: {
    role: SbRole;
    userId: string;
    userName: string;
    variant: "assign" | "revoke";
  }) {
    setConfirmation({
      kind: "sb-role",
      role,
      userId,
      userName,
      variant,
    });
  }

  function requestEventRoleAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = users.find((profile) => profile.authUserId === selectedEventUserId);

    if (!user || !user.uomVerified) {
      setStatus("error");
      setMessage("Only UoM verified profiles can receive event responsibilities.");
      return;
    }

    setConfirmation({
      kind: "event-role-assign",
      payload: { ...eventRoleForm, userId: selectedEventUserId },
      roleDisplayName: getEventRoleDisplayName(eventRoleForm.role, {
        chairCount:
          eventRoleForm.role === "Chair"
            ? (eventChairCounts.get(
                normalizeEventReference(eventRoleForm.eventId).toLowerCase(),
              ) ?? 0) + 1
            : 0,
      }),
      userName: user?.name || user?.googleEmail || eventRoleForm.userId,
    });
  }

  function requestEventRoleRevoke(
    assignment: EventRoleAssignment & { userName: string },
  ) {
    setConfirmation({
      assignmentId: assignment.$id,
      committeeName: assignment.committeeName,
      eventTitle: assignment.eventTitle,
      kind: "event-role-revoke",
      role: assignment.role,
      roleDisplayName: getEventRoleDisplayName(assignment.role, {
        chairCount:
          eventChairCounts.get(
            normalizeEventReference(assignment.eventId).toLowerCase(),
          ) ?? 0,
      }),
      userName: assignment.userName,
    });
  }

  async function runConfirmedAction() {
    if (!confirmation) {
      return;
    }

    const current = confirmation;
    setConfirmation(null);

    if (current.kind === "sb-role") {
      await updateSbRole({
        role: current.role,
        userId: current.userId,
        variant: current.variant,
      });
      return;
    }

    if (current.kind === "event-role-assign") {
      await assignEventRole(current.payload);
      return;
    }

    await revokeEventRole(current.assignmentId);
  }

  async function updateSbRole({
    role,
    userId,
    variant,
  }: {
    role: SbRole;
    userId: string;
    variant: "assign" | "revoke";
  }) {
    const actionKey = `${userId}:${role}`;
    setPendingAction(actionKey);
    setStatus("idle");
    setMessage(`${variant === "assign" ? "Assigning" : "Revoking"} ${role}...`);
    try {
      const response = await fetch(`/api/admin/roles/${variant}`, {
        body: JSON.stringify({ role, userId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Role update failed.");
        return;
      }

      await refreshUsers("Student Branch role updated.");
    } finally {
      setPendingAction(null);
    }
  }

  async function assignEventRole(payload: EventRoleFormState) {
    setPendingAction("event-role:assign");
    setStatus("idle");
    setMessage("Assigning event responsibility...");
    try {
      const response = await fetch("/api/admin/event-roles/assign", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const responsePayload = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(responsePayload.error ?? "Event role assignment failed.");
        return;
      }

      setEventRoleForm((current) => ({
        ...current,
        committeeName: "",
      }));
      await refreshUsers("Event responsibility assigned.");
    } finally {
      setPendingAction(null);
    }
  }

  async function revokeEventRole(assignmentId: string) {
    setPendingAction(`event-role:${assignmentId}`);
    setStatus("idle");
    setMessage("Revoking event responsibility...");
    try {
      const response = await fetch("/api/admin/event-roles/revoke", {
        body: JSON.stringify({ assignmentId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Event role revoke failed.");
        return;
      }

      await refreshUsers("Event responsibility revoked.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <SummaryTile label="Total profiles" value={String(users.length)} />
        <SummaryTile label="UoM verified" value={String(verifiedCount)} />
        <SummaryTile label="SB role holders" value={String(sbRoleAssignedCount)} />
        <SummaryTile label="Event roles" value={String(eventRoleAssignedCount)} />
      </section>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="inline-flex w-fit rounded-md border border-border bg-surface p-1">
          <button
            className={modeButtonClasses(mode === "branch")}
            onClick={() => setMode("branch")}
            type="button"
          >
            <UserCheck className="size-4" aria-hidden="true" />
            Branch roles
          </button>
          <button
            className={modeButtonClasses(mode === "events")}
            onClick={() => setMode("events")}
            type="button"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            Event responsibilities
          </button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:w-80">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search profiles or events"
              value={query}
            />
          </div>
          <Button onClick={() => refreshUsers()} type="button">
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {message ? <Notice message={message} status={status} /> : null}

      {mode === "branch" ? (
        <BranchRoleTable
          filteredUsers={filteredUsers}
          pendingAction={pendingAction}
          requestSbRoleChange={requestSbRoleChange}
        />
      ) : (
        <EventRolesPanel
          assignments={filteredEventAssignments}
          assignableUsers={verifiedUsers}
          committeeRequired={committeeRequired}
          eventChairCounts={eventChairCounts}
          eventRoleForm={eventRoleForm}
          pendingAction={pendingAction}
          requestEventRoleRevoke={requestEventRoleRevoke}
          selectedUserId={selectedEventUserId}
          setEventRoleForm={setEventRoleForm}
          requestEventRoleAssignment={requestEventRoleAssignment}
        />
      )}

      <ConfirmationDialog
        confirmation={confirmation}
        isBusy={Boolean(pendingAction)}
        onCancel={() => setConfirmation(null)}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}

function BranchRoleTable({
  filteredUsers,
  pendingAction,
  requestSbRoleChange,
}: {
  filteredUsers: AdminUser[];
  pendingAction: string | null;
  requestSbRoleChange: (input: {
    role: SbRole;
    userId: string;
    userName: string;
    variant: "assign" | "revoke";
  }) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-[1060px] divide-y divide-border text-left text-sm">
        <thead className="bg-surface-muted text-text-secondary">
          <tr>
            <th className="px-4 py-3 font-semibold">Profile</th>
            <th className="px-4 py-3 font-semibold">Google email</th>
            <th className="px-4 py-3 font-semibold">UoM status</th>
            <th className="px-4 py-3 font-semibold">SB roles</th>
            <th className="px-4 py-3 font-semibold">Role control</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {filteredUsers.map((user) => (
            <tr key={user.authUserId}>
              <td className="px-4 py-4">
                <p className="font-medium text-text-primary">
                  {user.name || "Not provided"}
                </p>
                <p className="mt-1 max-w-52 truncate text-xs text-text-muted">
                  {user.authUserId}
                </p>
              </td>
              <td className="px-4 py-4">
                <span className="break-all text-text-primary">{user.googleEmail}</span>
              </td>
              <td className="px-4 py-4">
                <Badge tone={user.uomVerified ? "success" : "warning"}>
                  {user.uomVerified ? user.uomEmail : "Not verified"}
                </Badge>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-1">
                  {user.sbRoles.length > 0 ? (
                    user.sbRoles.map((role) => (
                      <Badge key={role} tone="primary">
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <Badge>None</Badge>
                  )}
                </div>
              </td>
              <td className="px-4 py-4">
                <BranchRoleControl
                  pendingAction={pendingAction}
                  requestSbRoleChange={requestSbRoleChange}
                  user={user}
                />
              </td>
            </tr>
          ))}
          {filteredUsers.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-text-secondary" colSpan={5}>
                No profiles match the current search.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function BranchRoleControl({
  pendingAction,
  requestSbRoleChange,
  user,
}: {
  pendingAction: string | null;
  requestSbRoleChange: (input: {
    role: SbRole;
    userId: string;
    userName: string;
    variant: "assign" | "revoke";
  }) => void;
  user: AdminUser;
}) {
  const assignableRoles = user.uomVerified
    ? SB_ROLES.filter((role) => !user.sbRoles.includes(role))
    : [];
  const revokableRoles = SB_ROLES.filter((role) => user.sbRoles.includes(role));
  const [selectedAssignRole, setSelectedAssignRole] = useState<SbRole | "">(
    assignableRoles[0] ?? "",
  );
  const [selectedRevokeRole, setSelectedRevokeRole] = useState<SbRole | "">(
    revokableRoles[0] ?? "",
  );
  const currentAssignRole =
    assignableRoles.find((role) => role === selectedAssignRole) ?? assignableRoles[0];
  const currentRevokeRole =
    revokableRoles.find((role) => role === selectedRevokeRole) ?? revokableRoles[0];
  const displayName = user.name || user.googleEmail;

  return (
    <div className="grid gap-2 xl:grid-cols-2">
      <div className="rounded-md border border-border bg-surface-subtle p-3">
        <label className="block text-xs font-semibold text-text-secondary">
          Assign role
          <select
            className={cn(inputClasses, "mt-1")}
            disabled={!currentAssignRole}
            onChange={(event) => setSelectedAssignRole(event.target.value as SbRole)}
            value={currentAssignRole ?? ""}
          >
            {assignableRoles.length > 0 ? (
              assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))
            ) : (
              <option value="">
                {user.uomVerified ? "All roles assigned" : "Verification required"}
              </option>
            )}
          </select>
        </label>
        <Button
          className="mt-2 w-full"
          disabled={
            !currentAssignRole ||
            !user.uomVerified ||
            pendingAction === `${user.authUserId}:${currentAssignRole}`
          }
          onClick={() =>
            currentAssignRole
              ? requestSbRoleChange({
                  role: currentAssignRole,
                  userId: user.authUserId,
                  userName: displayName,
                  variant: "assign",
                })
              : undefined
          }
          type="button"
          variant="secondary"
        >
          <ShieldPlus className="size-4" aria-hidden="true" />
          Review Assign
        </Button>
        {!user.uomVerified ? (
          <p className="mt-2 text-xs leading-5 text-warning">
            Verify UoM email before assigning roles.
          </p>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-surface-subtle p-3">
        <label className="block text-xs font-semibold text-text-secondary">
          Revoke role
          <select
            className={cn(inputClasses, "mt-1")}
            disabled={!currentRevokeRole}
            onChange={(event) => setSelectedRevokeRole(event.target.value as SbRole)}
            value={currentRevokeRole ?? ""}
          >
            {revokableRoles.length > 0 ? (
              revokableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))
            ) : (
              <option value="">No role to revoke</option>
            )}
          </select>
        </label>
        <Button
          className="mt-2 w-full"
          disabled={!currentRevokeRole || pendingAction === `${user.authUserId}:${currentRevokeRole}`}
          onClick={() =>
            currentRevokeRole
              ? requestSbRoleChange({
                  role: currentRevokeRole,
                  userId: user.authUserId,
                  userName: displayName,
                  variant: "revoke",
                })
              : undefined
          }
          type="button"
          variant="ghost"
        >
          <ShieldMinus className="size-4" aria-hidden="true" />
          Review Revoke
        </Button>
      </div>
    </div>
  );
}

function EventRolesPanel({
  assignments,
  assignableUsers,
  committeeRequired,
  eventChairCounts,
  eventRoleForm,
  pendingAction,
  requestEventRoleRevoke,
  selectedUserId,
  setEventRoleForm,
  requestEventRoleAssignment,
}: {
  assignments: Array<
    EventRoleAssignment & {
      userEmail: string;
      userName: string;
      userVerified: boolean;
    }
  >;
  assignableUsers: AdminUser[];
  committeeRequired: boolean;
  eventChairCounts: Map<string, number>;
  eventRoleForm: EventRoleFormState;
  pendingAction: string | null;
  requestEventRoleRevoke: (
    assignment: EventRoleAssignment & { userName: string },
  ) => void;
  selectedUserId: string;
  setEventRoleForm: React.Dispatch<React.SetStateAction<EventRoleFormState>>;
  requestEventRoleAssignment: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <form
        className="rounded-md border border-border bg-surface-subtle p-4"
        onSubmit={requestEventRoleAssignment}
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-primary">
            Assign event responsibility
          </h3>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-text-secondary">
            Volunteer
            <select
              className={cn(inputClasses, "mt-1")}
              onChange={(event) =>
                setEventRoleForm((current) => ({
                  ...current,
                  userId: event.target.value,
                }))
              }
              required
              value={selectedUserId}
            >
              {assignableUsers.length > 0 ? (
                assignableUsers.map((user) => (
                  <option key={user.authUserId} value={user.authUserId}>
                    {user.name || user.googleEmail}
                  </option>
                ))
              ) : (
                <option value="">No verified profiles available</option>
              )}
            </select>
          </label>

          <label className="block text-sm font-medium text-text-secondary">
            Event reference
            <input
              className={cn(inputClasses, "mt-1")}
              onChange={(event) =>
                setEventRoleForm((current) => ({
                  ...current,
                  eventId: event.target.value,
                }))
              }
              placeholder="foresight-4.0"
              required
              value={eventRoleForm.eventId}
            />
          </label>

          <label className="block text-sm font-medium text-text-secondary">
            Event title
            <input
              className={cn(inputClasses, "mt-1")}
              onChange={(event) =>
                setEventRoleForm((current) => ({
                  ...current,
                  eventTitle: event.target.value,
                }))
              }
              placeholder="MoraForesight 4.0"
              required
              value={eventRoleForm.eventTitle}
            />
          </label>

          <label className="block text-sm font-medium text-text-secondary">
            Event role
            <select
              className={cn(inputClasses, "mt-1")}
              onChange={(event) =>
                setEventRoleForm((current) => ({
                  ...current,
                  committeeName: requiresCommitteeName(event.target.value as EventRole)
                    ? current.committeeName
                    : "",
                  role: event.target.value as EventRole,
                }))
              }
              value={eventRoleForm.role}
            >
              {EVENT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-text-secondary">
            Committee
            <input
              className={cn(inputClasses, "mt-1")}
              disabled={!committeeRequired}
              onChange={(event) =>
                setEventRoleForm((current) => ({
                  ...current,
                  committeeName: event.target.value,
                }))
              }
              placeholder={committeeRequired ? "Program, Logistics, Design" : "Not required"}
              required={committeeRequired}
              value={eventRoleForm.committeeName}
            />
          </label>
        </div>

        <Button
          className="mt-4 w-full"
          disabled={
            pendingAction === "event-role:assign" ||
            assignableUsers.length === 0 ||
            !selectedUserId
          }
          type="submit"
          variant="primary"
        >
          <ShieldPlus className="size-4" aria-hidden="true" />
          Review Responsibility
        </Button>
      </form>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-[920px] divide-y divide-border text-left text-sm">
          <thead className="bg-surface-muted text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">Volunteer</th>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Responsibility</th>
              <th className="px-4 py-3 font-semibold">Assigned</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {assignments.map((assignment) => (
              <tr key={assignment.$id}>
                <td className="px-4 py-4">
                  <p className="font-medium text-text-primary">{assignment.userName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-text-muted">{assignment.userEmail}</span>
                    <Badge tone={assignment.userVerified ? "success" : "warning"}>
                      {assignment.userVerified ? "Verified" : "Not verified"}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium text-text-primary">{assignment.eventTitle}</p>
                  <p className="mt-1 text-xs text-text-muted">{assignment.eventId}</p>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="primary">
                      {getEventRoleDisplayName(assignment.role, {
                        chairCount:
                          eventChairCounts.get(
                            normalizeEventReference(assignment.eventId).toLowerCase(),
                          ) ?? 0,
                      })}
                    </Badge>
                    {assignment.committeeName ? (
                      <Badge>{assignment.committeeName}</Badge>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-text-secondary">
                  {new Date(assignment.assignedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-4">
                  <Button
                    disabled={pendingAction === `event-role:${assignment.$id}`}
                    onClick={() => requestEventRoleRevoke(assignment)}
                    type="button"
                    variant="ghost"
                  >
                    <ShieldMinus className="size-4" aria-hidden="true" />
                    Review Revoke
                  </Button>
                </td>
              </tr>
            ))}
            {assignments.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-text-secondary" colSpan={5}>
                  No event responsibilities are assigned yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfirmationDialog({
  confirmation,
  isBusy,
  onCancel,
  onConfirm,
}: {
  confirmation: Confirmation | null;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!confirmation) {
    return null;
  }

  const details = getConfirmationDetails(confirmation);

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
              <h3 className="text-base font-semibold text-text-primary">
                Confirm Role Change
              </h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Review this change before it is written to the access-control audit trail.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          {details.map((detail) => (
            <div
              className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0"
              key={detail.label}
            >
              <span className="font-medium text-text-secondary">{detail.label}</span>
              <span className="text-right font-medium text-text-primary">
                {detail.value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button disabled={isBusy} onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={onConfirm} type="button" variant="primary">
            Confirm Change
          </Button>
        </div>
      </div>
    </div>
  );
}

function getConfirmationDetails(confirmation: Confirmation) {
  if (confirmation.kind === "sb-role") {
    return [
      { label: "Action", value: confirmation.variant === "assign" ? "Assign" : "Revoke" },
      { label: "Volunteer", value: confirmation.userName },
      { label: "Role", value: confirmation.role },
      { label: "Scope", value: "Student Branch" },
    ];
  }

  if (confirmation.kind === "event-role-assign") {
    return [
      { label: "Action", value: "Assign" },
      { label: "Volunteer", value: confirmation.userName },
      { label: "Role", value: confirmation.roleDisplayName },
      { label: "Event", value: confirmation.payload.eventTitle },
      {
        label: "Committee",
        value: confirmation.payload.committeeName || "Event-level",
      },
    ];
  }

  return [
    { label: "Action", value: "Revoke" },
    { label: "Volunteer", value: confirmation.userName },
    { label: "Role", value: confirmation.roleDisplayName },
    { label: "Event", value: confirmation.eventTitle },
    { label: "Committee", value: confirmation.committeeName || "Event-level" },
  ];
}

function Notice({ message, status }: { message: string; status: NoticeStatus }) {
  return (
    <p
      className={
        status === "error"
          ? "rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
          : "text-sm text-text-secondary"
      }
    >
      {message}
    </p>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        <Check className="size-4 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function modeButtonClasses(active: boolean) {
  return cn(
    buttonClasses({
      className: "h-9 border-transparent px-3",
      variant: active ? "secondary" : "ghost",
    }),
    active ? "bg-surface text-primary shadow-card" : "",
  );
}
