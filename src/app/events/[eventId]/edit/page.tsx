import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { EditEventForm } from "@/features/events/components/EditEventForm";
import {
  getEventUserContext,
  getPermissionsForUser,
  isEventVisible,
} from "@/features/events/server/event-route-helpers";
import { getEventById } from "@/features/events/server/event-service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function EditEventPage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    redirect("/verify-uom");
  }

  const { eventId } = await params;
  const event = await getEventById(eventId);

  if (!event) {
    redirect("/events");
  }

  const { userEventRole } = await getEventUserContext(eventId, user);

  if (!isEventVisible(user, event, userEventRole)) {
    redirect("/events");
  }

  const permissions = getPermissionsForUser(user, event, userEventRole);

  if (!permissions.canEdit) {
    redirect(`/events/${eventId}`);
  }

  return (
    <AppShell active="events" user={user}>
      <div className="space-y-6">
        <PageHeader
          title="Edit Event"
          description={event.title}
          actions={
            <Link className={buttonClasses()} href={`/events/${eventId}`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Event
            </Link>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>Update the event record. Changes are audited server-side.</CardDescription>
          </CardHeader>
          <CardContent>
            <EditEventForm event={event} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
