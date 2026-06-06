import { NextResponse } from "next/server";
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
  getRoleAssignmentsForEvent,
  getUserEventRole,
} from "@/features/events/server/event-roles.server";
import { getEventById } from "@/features/events/server/event-service";
import { AssignEventRoleInputSchema } from "@/features/events/types";
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
    const event = await getEventById(eventId);

    if (!event) {
      return jsonError("Event was not found.", 404);
    }

    const userEventRole = await getUserEventRole(user!.authUser.id, eventId);

    if (
      !canViewEventCommittees(user!.isAdmin, event, userEventRole, user!.authUser.id)
    ) {
      return jsonError("Event was not found.", 404);
    }

    const assignments = await getRoleAssignmentsForEvent(eventId);
    return NextResponse.json({ assignments, committees: assignments });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to list event role assignments.",
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

    const actorEventRole = await getUserEventRole(user!.authUser.id, eventId);

    if (
      !canAssignCommitteeRole({
        actorEventRole,
        isAdmin: user!.isAdmin,
        targetRole: parsed.data.role,
      })
    ) {
      return jsonError("You do not have permission to assign this event role.", 403);
    }

    const assignment = await assignEventRole(parsed.data, user!.authUser.id);
    return NextResponse.json({ assignment, committee: assignment }, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to assign event role.",
      routeErrorStatus(error),
    );
  }
}
