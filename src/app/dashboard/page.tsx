import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  MailCheck,
  ShieldCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { getEventRoleDisplayName } from "@/features/access-control/lib/rules";
import { NotificationPreferencesForm } from "@/features/notifications/components/notification-preferences-form";
import { getNotificationPreferencesForUser } from "@/features/notifications/server/notification-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const notificationPreference = await getNotificationPreferencesForUser(
    user.authUser.id,
  );

  return (
    <AppShell active="dashboard" user={user}>
      <div className="space-y-6">
        <PageHeader
          title="Access Overview"
          description="Account identity, verification state, and Student Branch privileges."
          actions={
            <>
              <Link
                className={buttonClasses({
                  variant: user.profile.uomVerified ? "secondary" : "primary",
                })}
                href="/verify-uom"
              >
                <MailCheck className="size-4" aria-hidden="true" />
                {user.profile.uomVerified ? "View Verification" : "Verify UoM Email"}
              </Link>
              {user.isAdmin ? (
                <Link
                  className={buttonClasses()}
                  href="/admin/users"
                >
                  <UsersRound className="size-4" aria-hidden="true" />
                  Access Control
                </Link>
              ) : null}
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            description={user.profile.uomEmail ?? "Verification required before volunteering"}
            icon={MailCheck}
            label="UoM Email"
            state={user.profile.uomVerified ? "Verified" : "Pending"}
            tone={user.profile.uomVerified ? "success" : "warning"}
            value={user.profile.uomVerified ? "Ready" : "Action required"}
          />
          <StatusCard
            description={user.isAdmin ? "Global administration access" : "Standard account"}
            icon={ShieldCheck}
            label="Admin Status"
            state={user.isAdmin ? "Enabled" : "Standard"}
            tone={user.isAdmin ? "success" : "neutral"}
            value={user.isAdmin ? "Administrator" : "Not Admin"}
          />
          <StatusCard
            description={
              user.sbRoles.length > 0
                ? user.sbRoles.join(", ")
                : "No Student Branch roles assigned"
            }
            icon={UsersRound}
            label="SB Roles"
            state={user.sbRoles.length > 0 ? "Assigned" : "None"}
            tone={user.sbRoles.length > 0 ? "primary" : "neutral"}
            value={String(user.sbRoles.length)}
          />
          <StatusCard
            description={
              user.eventRoles.length > 0
                ? `${user.eventRoles.length} active event assignment${
                    user.eventRoles.length === 1 ? "" : "s"
                  }`
                : "No event responsibilities assigned"
            }
            icon={CalendarDays}
            label="Event Roles"
            state={user.eventRoles.length > 0 ? "Assigned" : "None"}
            tone={user.eventRoles.length > 0 ? "primary" : "neutral"}
            value={String(user.eventRoles.length)}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-4 text-primary" aria-hidden="true" />
                Account Details
              </CardTitle>
              <CardDescription>Google identity and platform profile status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="Name" value={user.authUser.name || "Not provided"} />
              <InfoRow label="Google email" value={user.authUser.email} />
              <InfoRow label="User ID" value={user.authUser.id} />
              <InfoRow label="Profile status" value={user.profile.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                Access State
              </CardTitle>
              <CardDescription>Current server-side authorization state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge tone={user.isAdmin ? "success" : "neutral"}>
                  {user.isAdmin ? "Admin" : "Not Admin"}
                </Badge>
                <Badge tone={user.profile.uomVerified ? "success" : "warning"}>
                  {user.profile.uomVerified ? "UoM verified" : "UoM not verified"}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">SB roles</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user.sbRoles.length > 0 ? (
                    user.sbRoles.map((role) => (
                      <Badge key={role} tone="primary">
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <Badge>No assigned SB roles</Badge>
                  )}
                </div>
              </div>
              <InfoRow
                label="Verified UoM email"
                value={user.profile.uomEmail ?? "Not verified yet"}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailCheck className="size-4 text-primary" aria-hidden="true" />
              Notification Preferences
            </CardTitle>
            <CardDescription>In-app and email delivery choices.</CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationPreferencesForm initialPreference={notificationPreference} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              Event Responsibilities
            </CardTitle>
            <CardDescription>
              Active event-scoped roles assigned by the Admin account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.eventRoles.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[720px] divide-y divide-border text-left text-sm">
                  <thead className="text-text-secondary">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Event</th>
                      <th className="px-4 py-2 font-semibold">Role</th>
                      <th className="px-4 py-2 font-semibold">Committee</th>
                      <th className="px-4 py-2 font-semibold">Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {user.eventRoles.map((assignment) => (
                      <tr key={assignment.$id}>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-text-primary">
                            {assignment.eventTitle}
                          </p>
                          <p className="mt-1 text-xs text-text-muted">
                            {assignment.eventId}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone="primary">
                            {getEventRoleDisplayName(assignment.role, {
                              chairCount: assignment.eventChairCount ?? 0,
                            })}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {assignment.committeeName ?? "Event-level"}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {new Date(assignment.assignedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                No event responsibilities are currently assigned to this account.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StatusCard({
  description,
  icon: Icon,
  label,
  state,
  tone,
  value,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  state: string;
  tone: "neutral" | "primary" | "success" | "warning";
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-secondary">{label}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xl font-semibold text-text-primary">{value}</p>
            <Badge tone={tone}>{state}</Badge>
          </div>
          <p className="mt-1 break-words text-sm leading-5 text-text-secondary">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="font-medium text-text-secondary">{label}</span>
      <span className="break-all text-text-primary">{value}</span>
    </div>
  );
}
