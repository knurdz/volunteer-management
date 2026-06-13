import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { CreateEventForm } from "@/features/events/components/CreateEventForm";
import { canCreateEvent } from "@/features/events/server/event-route-helpers";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!canCreateEvent(user)) {
    redirect("/events");
  }

  return (
    <AppShell active="events" user={user}>
      <div className="space-y-6">
        <PageHeader
          title="Create Event"
          description="Register a new branch event in draft status."
          actions={
            <Link className={buttonClasses()} href="/events">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Events
            </Link>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>
              Required fields are validated before the event record is created.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateEventForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
