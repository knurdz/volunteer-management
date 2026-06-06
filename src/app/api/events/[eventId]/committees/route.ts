import { NextResponse } from "next/server";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  canAssignCommitteeRole,
  canViewEventCommittees,
} from "@/features/events/lib/committee-permissions";
import {
  parseValidationBody,
  requireVerifiedVolunteer,
} from "@/features/events/server/event-route-helpers";
import {
  assignEventRole,
  getCommitteesForEvent,
  getUserEventRole,
} from "@/features/events/server/committee-service";
import { getEventById } from "@/features/events/server/event-service";
import { AssignEventRoleInputSchema } from "@/features/events/types";
import { jsonError } from "@/server/errors";

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
    const event = await getEventById(eventId);

    if (!event) {
      return jsonError("Event was not found.", 404);
    }

    const userCommitteeRole = (await getUserEventRole(user!.authUser.id, eventId))?.role ?? null;

    if (!canViewEventCommittees(user!, event, userCommitteeRole)) {
      return jsonError("Event was not found.", 404);
    }

    const committees = await getCommitteesForEvent(eventId);
    return NextResponse.json({ committees });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to list event committees.",
      400,
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    return jsonError("Verified UoM email is required before volunteering.", 403);
  }

  const { eventId } = await context.params;
  const parsed = parseValidationBody(AssignEventRoleInputSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

  if (parsed.data.event_id !== eventId) {
    return jsonError("Event ID in the request body must match the route.", 400);
  }

  try {
    const event = await getEventById(eventId);

    if (!event) {
      return jsonError("Event was not found.", 404);
    }

    const actorCommitteeRole = (await getUserEventRole(user.authUser.id, eventId))?.role ?? null;

    if (
      !canAssignCommitteeRole({
        actorCommitteeRole,
        isAdmin: user.isAdmin,
        targetRole: parsed.data.role,
      })
    ) {
      return jsonError("You do not have permission to assign this event role.", 403);
    }

    const committee = await assignEventRole(parsed.data, user.authUser.id);
    return NextResponse.json({ committee }, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to assign event role.",
      400,
    );
  }
}
