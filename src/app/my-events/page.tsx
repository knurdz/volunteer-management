import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { MyEvents } from "@/features/events/components/MyEvents";
import { getEventsForUser } from "@/features/events/server/event-roles.server";

export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && !user.profile.uomVerified) {
    redirect("/verify-uom");
  }

  const userEvents = await getEventsForUser(user.authUser.id);

  return (
    <AppShell active="my-events" user={user}>
      <MyEvents events={userEvents} />
    </AppShell>
  );
}
