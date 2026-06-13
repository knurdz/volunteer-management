import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { EventList } from "@/features/events/components/EventList";
import { canCreateEvent } from "@/features/events/server/event-route-helpers";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    redirect("/verify-uom");
  }

  return (
    <AppShell active="events" user={user}>
      <EventList canCreate={canCreateEvent(user)} />
    </AppShell>
  );
}
