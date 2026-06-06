import { NextResponse } from "next/server";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { canRemoveCommitteeRole } from "@/features/events/lib/committee-permissions";
import {
  getCommitteeById,
  getUserEventRole,
  removeEventRole,
} from "@/features/events/server/committee-service";
import { getEventById } from "@/features/events/server/event-service";
import { jsonError } from "@/server/errors";

type RouteContext = {
  params: Promise<{ committeeId: string; eventId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    return jsonError("Verified UoM email is required before volunteering.", 403);
  }

  const { committeeId, eventId } = await context.params;

  try {
    const [event, committee] = await Promise.all([
      getEventById(eventId),
      getCommitteeById(committeeId),
    ]);

    if (!event || !committee || committee.event_id !== eventId) {
      return jsonError("Committee assignment was not found.", 404);
    }

    if (!committee.is_active) {
      return jsonError("Committee assignment was not found.", 404);
    }

    const actorCommitteeRole = (await getUserEventRole(user.authUser.id, eventId))?.role ?? null;

    if (
      !canRemoveCommitteeRole({
        actorCommitteeRole,
        actorUserId: user.authUser.id,
        isAdmin: user.isAdmin,
        targetCommittee: committee,
      })
    ) {
      return jsonError("You do not have permission to remove this event role.", 403);
    }

    await removeEventRole(committeeId, user.authUser.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to remove event role.",
      400,
    );
  }
}
