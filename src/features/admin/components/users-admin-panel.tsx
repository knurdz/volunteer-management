"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SB_ROLES } from "@/lib/config";
import type { Profile, SbRole } from "@/types/auth";

type AdminUser = Profile & {
  sbRoles: SbRole[];
};

export function UsersAdminPanel({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState(initialUsers);

  async function refreshUsers() {
    const response = await fetch("/api/admin/users");
    const payload = await response.json();

    if (response.ok) {
      setUsers(payload.users);
    }
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
    setMessage(`${variant === "assign" ? "Assigning" : "Revoking"} ${role}...`);
    const response = await fetch(`/api/admin/roles/${variant}`, {
      body: JSON.stringify({ role, userId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Role update failed.");
      return;
    }

    await refreshUsers();
    setMessage("Role updated.");
  }

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-text-secondary">{message}</p> : null}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full divide-y divide-border text-left text-sm">
          <thead className="bg-surface-muted text-text-secondary">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Google email</th>
              <th className="px-3 py-2 font-semibold">UoM</th>
              <th className="px-3 py-2 font-semibold">SB roles</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {users.map((user) => (
              <tr key={user.authUserId}>
                <td className="px-3 py-3">{user.name || "Not provided"}</td>
                <td className="px-3 py-3">{user.googleEmail}</td>
                <td className="px-3 py-3">
                  <Badge tone={user.uomVerified ? "success" : "warning"}>
                    {user.uomVerified ? user.uomEmail : "Not verified"}
                  </Badge>
                </td>
                <td className="px-3 py-3">
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
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    {SB_ROLES.map((role) => {
                      const assigned = user.sbRoles.includes(role);

                      return (
                        <Button
                          key={role}
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
                          {assigned ? `Revoke ${role}` : `Assign ${role}`}
                        </Button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
