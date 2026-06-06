import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { canRemoveCommitteeRole } from "@/features/events/lib/committee-permissions";
import { requireVerifiedVolunteer } from "@/features/events/server/event-route-helpers";
import {
  getRoleAssignmentsForEvent,
  getUserEventRole,
  removeEventRole,
} from "@/features/events/server/event-roles.server";
import { getEventById } from "@/features/events/server/event-service";
import { jsonError, routeErrorStatus } from "@/server/errors";

type RouteContext = {
  params: Promise<{ committeeId: string; eventId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const authError = requireVerifiedVolunteer(user);

  if (authError) {
    return authError;
  }

  const { committeeId, eventId } = await context.params;

  try {
    const [event, assignments] = await Promise.all([
      getEventById(eventId),
      getRoleAssignmentsForEvent(eventId),
    ]);

    const assignment = assignments.find((entry) => entry.$id === committeeId);

    if (!event || !assignment) {
      return jsonError("Role assignment was not found.", 404);
    }

    const actorEventRole = await getUserEventRole(user!.authUser.id, eventId);

    if (
      !canRemoveCommitteeRole({
        actorEventRole,
        actorUserId: user!.authUser.id,
        isAdmin: user!.isAdmin,
        targetAssignment: assignment,
      })
    ) {
      return jsonError("You do not have permission to remove this event role.", 403);
    }

    await removeEventRole(committeeId, user!.authUser.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to remove event role.",
      routeErrorStatus(error),
    );
  }
}
