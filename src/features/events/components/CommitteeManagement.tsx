"use client";

import { useCallback, useState } from "react";
import { Loader2, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { eventInputClasses } from "@/features/events/lib/event-ui";
import type { Committee, CommitteeMember } from "@/features/events/types";
import { cn } from "@/lib/utils";

type CommitteeWithMembers = Committee & {
  members: CommitteeMember[];
};

export function CommitteeManagement({
  canManage,
  eventId,
  initialCommittees,
}: Readonly<{
  canManage: boolean;
  eventId: string;
  initialCommittees: CommitteeWithMembers[];
}>) {
  const [committees, setCommittees] = useState<CommitteeWithMembers[]>(initialCommittees);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberUserId, setMemberUserId] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const refreshCommittees = useCallback(async () => {
    const response = await fetch(`/api/events/${eventId}/committees`);
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Could not load committees.");
      return;
    }

    const nextCommittees: CommitteeWithMembers[] = await Promise.all(
      (payload.committees as Committee[]).map(async (committee) => {
        const membersResponse = await fetch(
          `/api/events/${eventId}/committees/${committee.$id}/members`,
        );
        const membersPayload = await membersResponse.json();

        return {
          ...committee,
          members: membersResponse.ok ? (membersPayload.members ?? []) : [],
        };
      }),
    );

    setCommittees(nextCommittees);
  }, [eventId]);

  async function handleCreateCommittee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-committee");
    setError("");

    try {
      const response = await fetch(`/api/events/${eventId}/committees`, {
        body: JSON.stringify({
          description: description || undefined,
          event_id: eventId,
          name,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not create committee.");
        return;
      }

      setName("");
      setDescription("");
      await refreshCommittees();
    } catch {
      setError("Could not create committee.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteCommittee(committeeId: string) {
    setPendingAction(committeeId);
    setError("");

    try {
      const response = await fetch(`/api/events/${eventId}/committees/${committeeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? "Could not delete committee.");
        return;
      }

      await refreshCommittees();
    } catch {
      setError("Could not delete committee.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAddMember(committeeId: string) {
    const userId = memberUserId[committeeId]?.trim();

    if (!userId) {
      return;
    }

    setPendingAction(`member:${committeeId}`);
    setError("");

    try {
      const response = await fetch(
        `/api/events/${eventId}/committees/${committeeId}/members`,
        {
          body: JSON.stringify({ user_id: userId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not add committee member.");
        return;
      }

      setMemberUserId((current) => ({ ...current, [committeeId]: "" }));
      await refreshCommittees();
    } catch {
      setError("Could not add committee member.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemoveMember(committeeId: string, memberId: string) {
    setPendingAction(memberId);
    setError("");

    try {
      const response = await fetch(
        `/api/events/${eventId}/committees/${committeeId}/members/${memberId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? "Could not remove committee member.");
        return;
      }

      await refreshCommittees();
    } catch {
      setError("Could not remove committee member.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-primary" aria-hidden="true" />
          Committees
        </CardTitle>
        <CardDescription>
          Structural committees used when assigning Committee Lead and Committee Member roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {canManage ? (
          <form className="space-y-3 rounded-md border border-border p-4" onSubmit={handleCreateCommittee}>
            <h3 className="text-sm font-semibold text-text-primary">Create Committee</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium text-text-secondary" htmlFor="committee_name">
                Name
                <input
                  className={cn(eventInputClasses, "mt-1")}
                  id="committee_name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </label>
              <label className="block text-sm font-medium text-text-secondary" htmlFor="committee_description">
                Description
                <input
                  className={cn(eventInputClasses, "mt-1")}
                  id="committee_description"
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </label>
            </div>
            <Button disabled={pendingAction === "create-committee"} type="submit" variant="primary">
              <Plus className="size-4" aria-hidden="true" />
              {pendingAction === "create-committee" ? "Creating..." : "Create Committee"}
            </Button>
          </form>
        ) : null}

        {committees.length === 0 ? (
          <p className="text-sm text-text-secondary">No committees have been created for this event.</p>
        ) : (
          <div className="space-y-4">
            {committees.map((committee) => (
              <div className="rounded-md border border-border p-4" key={committee.$id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-text-primary">{committee.name}</h3>
                    {committee.description ? (
                      <p className="mt-1 text-sm text-text-secondary">{committee.description}</p>
                    ) : null}
                  </div>
                  {canManage ? (
                    <Button
                      disabled={pendingAction === committee.$id}
                      onClick={() => handleDeleteCommittee(committee.$id)}
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-medium text-text-secondary">Members</h4>
                  {committee.members.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {committee.members.map((member) => (
                        <li className="flex items-center justify-between gap-3" key={member.$id}>
                          <span className="text-text-primary">{member.user_id}</span>
                          {canManage ? (
                            <Button
                              disabled={pendingAction === member.$id}
                              onClick={() => handleRemoveMember(committee.$id, member.$id)}
                              type="button"
                              variant="ghost"
                            >
                              Remove
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-muted">No members yet.</p>
                  )}

                  {canManage ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="block flex-1 text-sm font-medium text-text-secondary">
                        User ID
                        <input
                          className={cn(eventInputClasses, "mt-1")}
                          onChange={(event) =>
                            setMemberUserId((current) => ({
                              ...current,
                              [committee.$id]: event.target.value,
                            }))
                          }
                          value={memberUserId[committee.$id] ?? ""}
                        />
                      </label>
                      <Button
                        disabled={pendingAction === `member:${committee.$id}`}
                        onClick={() => handleAddMember(committee.$id)}
                        type="button"
                        variant="primary"
                      >
                        {pendingAction === `member:${committee.$id}` ? (
                          <>
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <UserPlus className="size-4" aria-hidden="true" />
                            Add Member
                          </>
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {error ? (
          <p className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
