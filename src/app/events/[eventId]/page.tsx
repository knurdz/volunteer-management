import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { EventDetail } from "@/features/events/components/EventDetail";
import {
  getEventUserContext,
  getPermissionsForUser,
  isEventVisible,
} from "@/features/events/server/event-route-helpers";
import { listCommitteesForEvent, listCommitteeMembers } from "@/features/events/server/committees.server";
import { getRoleAssignmentsForEvent } from "@/features/events/server/event-roles.server";
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

  const { userEventRole } = await getEventUserContext(eventId, user);

  if (!isEventVisible(user, event, userEventRole)) {
    redirect("/events");
  }

  const [assignments, committees, permissions] = await Promise.all([
    getRoleAssignmentsForEvent(eventId),
    listCommitteesForEvent(eventId).then(async (items) =>
      Promise.all(
        items.map(async (committee) => ({
          ...committee,
          members: await listCommitteeMembers(committee.$id),
        })),
      ),
    ),
    Promise.resolve(getPermissionsForUser(user, event, userEventRole)),
  ]);

  return (
    <AppShell active="events" user={user}>
      <EventDetail
        currentUserId={user.authUser.id}
        initialAssignments={assignments}
        initialCommittees={committees}
        initialEvent={event}
        initialPermissions={permissions}
        isAdmin={user.isAdmin}
        userEventRole={userEventRole}
      />
    </AppShell>
  );
}
