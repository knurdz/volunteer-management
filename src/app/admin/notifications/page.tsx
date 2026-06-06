import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BellPlus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { listProfiles } from "@/features/access-control/server/profiles";
import { listActiveEventRoleAssignments } from "@/features/access-control/server/roles";
import {
  AdminNotificationForm,
  type NotificationEventOption,
} from "@/features/notifications/components/admin-notification-form";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const [profiles, eventAssignments] = await Promise.all([
    listProfiles(),
    listActiveEventRoleAssignments(),
  ]);
  const eventOptions = buildEventOptions(eventAssignments);

  return (
    <AppShell active="notifications" user={currentUser}>
      <div className="space-y-6">
        <PageHeader
          title="Send Notification"
          description="Create an in-app notification and optionally request email delivery."
          actions={
            <Link className={buttonClasses()} href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Overview
            </Link>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellPlus className="size-4 text-primary" aria-hidden="true" />
              Notification Composer
            </CardTitle>
            <CardDescription>
              Admin-only server action. Normal users cannot create arbitrary notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminNotificationForm eventOptions={eventOptions} profiles={profiles} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function buildEventOptions(
  assignments: Awaited<ReturnType<typeof listActiveEventRoleAssignments>>,
): NotificationEventOption[] {
  const events = new Map<
    string,
    {
      eventTitle: string;
      userIds: Set<string>;
    }
  >();

  for (const assignment of assignments) {
    const event = events.get(assignment.eventId) ?? {
      eventTitle: assignment.eventTitle,
      userIds: new Set<string>(),
    };

    event.userIds.add(assignment.userId);
    events.set(assignment.eventId, event);
  }

  return Array.from(events.entries())
    .map(([eventId, event]) => ({
      eventId,
      eventTitle: event.eventTitle,
      recipientCount: event.userIds.size,
    }))
    .sort((a, b) => a.eventTitle.localeCompare(b.eventTitle));
}
