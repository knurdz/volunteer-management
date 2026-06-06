import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { EventDetail } from "@/features/events/components/EventDetail";
import { getCommitteesForEvent } from "@/features/events/server/committee-service";
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

export default async function EventDetailPage({ params }: PageProps) {
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

  const { userCommitteeRole } = await getEventUserContext(eventId, user);

  if (!isEventVisible(user, event, userCommitteeRole)) {
    redirect("/events");
  }

  const [committees, permissions] = await Promise.all([
    getCommitteesForEvent(eventId),
    Promise.resolve(getPermissionsForUser(user, event, userCommitteeRole)),
  ]);

  return (
    <AppShell active="events" user={user}>
      <EventDetail
        currentUserId={user.authUser.id}
        initialCommittees={committees}
        initialEvent={event}
        initialPermissions={permissions}
        isAdmin={user.isAdmin}
        userCommitteeRole={userCommitteeRole}
      />
    </AppShell>
  );
}
