import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { MyEvents } from "@/features/events/components/MyEvents";
import { getEventsForUser } from "@/features/events/server/committee-service";

export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!canVolunteer(user.profile)) {
    redirect("/verify-uom");
  }

  const userEvents = await getEventsForUser(user.authUser.id);

  return (
    <AppShell active="my-events" user={user}>
      <MyEvents events={userEvents} />
    </AppShell>
  );
}
