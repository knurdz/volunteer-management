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
  createCommittee,
  listCommitteesForEvent,
} from "@/features/events/server/committees.server";
import { CreateCommitteeInputSchema } from "@/features/events/types";
import { ForbiddenError, jsonError, routeErrorStatus } from "@/server/errors";

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
    const { event, userEventRole } = await requireVisibleEvent(eventId, user!);

    if (!canViewEventCommittees(user!.authUser.id, user!.isAdmin, event, userEventRole)) {
      return jsonError("Event was not found.", 404);
    }

    const committees = await listCommitteesForEvent(eventId);
    return NextResponse.json({ committees });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to list committees.",
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

  const { eventId } = await context.params;
  const parsed = parseValidationBody(CreateCommitteeInputSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

  if (parsed.data.event_id !== eventId) {
    return jsonError("Event ID in the request body must match the route.", 400);
  }

  try {
    const { userEventRole } = await requireVisibleEvent(eventId, user!);

    if (
      !canManageStructuralCommittees({
        isAdmin: user!.isAdmin,
        userEventRole,
      })
    ) {
      throw new ForbiddenError("You do not have permission to manage committees.");
    }

    const committee = await createCommittee(parsed.data, user!.authUser.id);
    return NextResponse.json({ committee }, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to create committee.",
      routeErrorStatus(error),
    );
  }
}
