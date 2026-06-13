import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { canAssignCommitteeRole } from "@/features/events/lib/committee-permissions";
import {
  parseValidationBody,
  requireVerifiedVolunteer,
  requireVisibleEvent,
} from "@/features/events/server/event-route-helpers";
import {
  assignEventRole,
  getRoleAssignmentsForEvent,
} from "@/features/events/server/event-roles.server";
import { AssignEventRoleInputSchema } from "@/features/events/types";
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
    await requireVisibleEvent(eventId, user!);
    const assignments = await getRoleAssignmentsForEvent(eventId);
    return NextResponse.json({ assignments });
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
    const { userEventRole } = await requireVisibleEvent(eventId, user!);

    if (
      !canAssignCommitteeRole({
        actorEventRole: userEventRole,
        isAdmin: user!.isAdmin,
        targetRole: parsed.data.role,
      })
    ) {
      throw new ForbiddenError("You do not have permission to assign this event role.");
    }

    const assignment = await assignEventRole(parsed.data, user!.authUser.id);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to assign event role.",
      routeErrorStatus(error),
    );
  }
}
