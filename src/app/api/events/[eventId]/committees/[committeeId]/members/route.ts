import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  canManageStructuralCommittees,
  canViewEventCommittees,
} from "@/features/events/lib/committee-permissions";
import {
  parseValidationBody,
  requireVerifiedVolunteer,
  requireVisibleEvent,
} from "@/features/events/server/event-route-helpers";
import {
  addCommitteeMember,
  getCommitteeById,
  listCommitteeMembers,
} from "@/features/events/server/committees.server";
import { AddCommitteeMemberInputSchema } from "@/features/events/types";
import { ForbiddenError, jsonError, routeErrorStatus } from "@/server/errors";

type RouteContext = {
  params: Promise<{ committeeId: string; eventId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const authError = requireVerifiedVolunteer(user);

  if (authError) {
    return authError;
  }

  const { committeeId, eventId } = await context.params;

  try {
    const { event, userEventRole } = await requireVisibleEvent(eventId, user!);

    if (!canViewEventCommittees(user!.authUser.id, user!.isAdmin, event, userEventRole)) {
      return jsonError("Event was not found.", 404);
    }

    const committee = await getCommitteeById(committeeId);

    if (!committee || committee.event_id !== eventId) {
      return jsonError("Committee was not found.", 404);
    }

    const members = await listCommitteeMembers(committeeId);
    return NextResponse.json({ members });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to list committee members.",
      routeErrorStatus(error),
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const authError = requireVerifiedVolunteer(user);

  if (authError) {
    return authError;
  }

  const { committeeId, eventId } = await context.params;
  const parsed = parseValidationBody(AddCommitteeMemberInputSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

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

    const member = await addCommitteeMember({
      actorUserId: user!.authUser.id,
      committeeId,
      userId: parsed.data.user_id,
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to add committee member.",
      routeErrorStatus(error),
    );
  }
}
