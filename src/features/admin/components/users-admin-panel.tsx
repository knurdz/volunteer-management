"use client";

import { useMemo, useState } from "react";
import { Check, RefreshCw, Search, ShieldMinus, ShieldPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SB_ROLES } from "@/lib/config";
import type { Profile, SbRole } from "@/types/auth";

type AdminUser = Profile & {
  sbRoles: SbRole[];
};

export function UsersAdminPanel({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [status, setStatus] = useState<"error" | "idle" | "success">("idle");
  const [users, setUsers] = useState(initialUsers);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return users;
    }

    return users.filter((user) =>
      [user.name, user.googleEmail, user.uomEmail, user.authUserId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [query, users]);

  const verifiedCount = users.filter((user) => user.uomVerified).length;
  const roleAssignedCount = users.filter((user) => user.sbRoles.length > 0).length;

  async function refreshUsers() {
    setStatus("idle");
    setMessage("Refreshing users...");
    const response = await fetch("/api/admin/users");
    const payload = await response.json();

    if (response.ok) {
      setUsers(payload.users);
      setStatus("success");
      setMessage("User list refreshed.");
      return;
    }

    setStatus("error");
    setMessage(payload.error ?? "Could not refresh users.");
  }

  async function updateRole({
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

      await refreshUsers();
      setStatus("success");
      setMessage("Role updated.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryTile label="Total profiles" value={String(users.length)} />
        <SummaryTile label="UoM verified" value={String(verifiedCount)} />
        <SummaryTile label="With SB roles" value={String(roleAssignedCount)} />
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search profiles"
            value={query}
          />
        </div>
        <Button onClick={refreshUsers} type="button">
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {message ? (
        <p
          className={
            status === "error"
              ? "rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
              : "text-sm text-text-secondary"
          }
        >
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-[980px] divide-y divide-border text-left text-sm">
          <thead className="bg-surface-muted text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">Profile</th>
              <th className="px-4 py-3 font-semibold">Google email</th>
              <th className="px-4 py-3 font-semibold">UoM status</th>
              <th className="px-4 py-3 font-semibold">SB roles</th>
              <th className="px-4 py-3 font-semibold">Role controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {filteredUsers.map((user) => (
              <tr key={user.authUserId}>
                <td className="px-4 py-4">
                  <p className="font-medium text-text-primary">
                    {user.name || "Not provided"}
                  </p>
                  <p className="mt-1 max-w-48 truncate text-xs text-text-muted">
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
                  <div className="grid gap-2 sm:grid-cols-3">
                    {SB_ROLES.map((role) => {
                      const assigned = user.sbRoles.includes(role);
                      const actionKey = `${user.authUserId}:${role}`;

                      return (
                        <Button
                          key={role}
                          className="justify-start"
                          disabled={pendingAction === actionKey}
                          onClick={() =>
                            updateRole({
                              role,
                              userId: user.authUserId,
                              variant: assigned ? "revoke" : "assign",
                            })
                          }
                          type="button"
                          variant={assigned ? "ghost" : "secondary"}
                        >
                          {assigned ? (
                            <ShieldMinus className="size-4" aria-hidden="true" />
                          ) : (
                            <ShieldPlus className="size-4" aria-hidden="true" />
                          )}
                          {assigned ? `Revoke ${role}` : `Assign ${role}`}
                        </Button>
                      );
                    })}
                  </div>
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
    </div>
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
