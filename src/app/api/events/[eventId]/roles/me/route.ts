import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { requireVerifiedVolunteer, requireVisibleEvent } from "@/features/events/server/event-route-helpers";
import { getUserEventRoleAssignment } from "@/features/events/server/event-roles.server";
import { jsonError, routeErrorStatus } from "@/server/errors";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const authError = requireVerifiedVolunteer(user);

  if (authError) {
    return authError;
  }

  const { eventId } = await context.params;

  try {
    await requireVisibleEvent(eventId, user!);
    const assignment = await getUserEventRoleAssignment(user!.authUser.id, eventId);
    return NextResponse.json({ assignment });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch your event role.",
      routeErrorStatus(error),
    );
  }
}
