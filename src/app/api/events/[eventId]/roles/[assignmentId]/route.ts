import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { canRemoveCommitteeRole } from "@/features/events/lib/committee-permissions";
import { requireVerifiedVolunteer, requireVisibleEvent } from "@/features/events/server/event-route-helpers";
import {
  getRoleAssignmentsForEvent,
  removeEventRole,
} from "@/features/events/server/event-roles.server";
import { ForbiddenError, jsonError, routeErrorStatus } from "@/server/errors";

type RouteContext = {
  params: Promise<{ assignmentId: string; eventId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const authError = requireVerifiedVolunteer(user);

  if (authError) {
    return authError;
  }

  const { assignmentId, eventId } = await context.params;

  try {
    const { userEventRole } = await requireVisibleEvent(eventId, user!);
    const assignments = await getRoleAssignmentsForEvent(eventId);
    const assignment = assignments.find((entry) => entry.$id === assignmentId);

    if (!assignment) {
      return jsonError("Role assignment was not found.", 404);
    }

    if (
      !canRemoveCommitteeRole({
        actorEventRole: userEventRole,
        actorUserId: user!.authUser.id,
        isAdmin: user!.isAdmin,
        targetAssignment: assignment,
      })
    ) {
      throw new ForbiddenError("You do not have permission to remove this event role.");
    }

    await removeEventRole(assignmentId, user!.authUser.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to remove event role.",
      routeErrorStatus(error),
    );
  }
}
