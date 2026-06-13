import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { canManageStructuralCommittees } from "@/features/events/lib/committee-permissions";
import { requireVerifiedVolunteer, requireVisibleEvent } from "@/features/events/server/event-route-helpers";
import {
  deleteCommittee,
  getCommitteeById,
} from "@/features/events/server/committees.server";
import { ForbiddenError, jsonError, routeErrorStatus } from "@/server/errors";

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
    const { userEventRole } = await requireVisibleEvent(eventId, user!);
    const committee = await getCommitteeById(committeeId);

    if (!committee || committee.event_id !== eventId) {
      return jsonError("Committee was not found.", 404);
    }

    if (
      !canManageStructuralCommittees({
        isAdmin: user!.isAdmin,
        userEventRole,
      })
    ) {
      throw new ForbiddenError("You do not have permission to manage committees.");
    }

    await deleteCommittee(committeeId, user!.authUser.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to delete committee.",
      routeErrorStatus(error),
    );
  }
}
