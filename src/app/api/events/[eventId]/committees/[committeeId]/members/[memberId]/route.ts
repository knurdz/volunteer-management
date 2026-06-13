import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { canManageStructuralCommittees } from "@/features/events/lib/committee-permissions";
import { requireVerifiedVolunteer, requireVisibleEvent } from "@/features/events/server/event-route-helpers";
import {
  getCommitteeById,
  listCommitteeMembers,
  removeCommitteeMember,
} from "@/features/events/server/committees.server";
import { ForbiddenError, jsonError, routeErrorStatus } from "@/server/errors";

type RouteContext = {
  params: Promise<{ committeeId: string; eventId: string; memberId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const authError = requireVerifiedVolunteer(user);

  if (authError) {
    return authError;
  }

  const { committeeId, eventId, memberId } = await context.params;

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

    const members = await listCommitteeMembers(committeeId);
    const member = members.find((entry) => entry.$id === memberId);

    if (!member) {
      return jsonError("Committee member was not found.", 404);
    }

    await removeCommitteeMember({
      actorUserId: user!.authUser.id,
      committeeId,
      memberId,
      userId: member.user_id,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to remove committee member.",
      routeErrorStatus(error),
    );
  }
}
