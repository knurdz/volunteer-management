import { NextResponse } from "next/server";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  getEventUserContext,
  getPermissionsForUser,
  isEventVisible,
  parseValidationBody,
} from "@/features/events/server/event-route-helpers";
import {
  approveConclusion,
  getEventById,
  rejectConclusion,
  submitConclusion,
} from "@/features/events/server/event-service";
import { ConclusionActionSchema } from "@/features/events/types";
import { ForbiddenError, jsonError, routeErrorStatus } from "@/server/errors";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    return jsonError("Verified UoM email is required before volunteering.", 403);
  }

  const { eventId } = await context.params;
  const parsed = parseValidationBody(ConclusionActionSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

  try {
    const existingEvent = await getEventById(eventId);

    if (!existingEvent) {
      return jsonError("Event was not found.", 404);
    }

    const { userEventRole } = await getEventUserContext(eventId, user);

    if (!isEventVisible(user, existingEvent, userEventRole)) {
      return jsonError("Event was not found.", 404);
    }

    const permissions = getPermissionsForUser(user, existingEvent, userEventRole);
    const { action } = parsed.data;

    if (action === "submit") {
      if (!permissions.canSubmitConclusion) {
        throw new ForbiddenError("You do not have permission to submit the conclusion.");
      }

      const event = await submitConclusion(eventId, user.authUser.id);
      return NextResponse.json({ event });
    }

    if (action === "approve") {
      if (!permissions.canApproveConclusion) {
        throw new ForbiddenError("You do not have permission to approve the conclusion.");
      }

      const event = await approveConclusion(eventId, user.authUser.id);
      return NextResponse.json({ event });
    }

    if (action === "reject") {
      if (!permissions.canApproveConclusion) {
        throw new ForbiddenError("You do not have permission to reject the conclusion.");
      }

      const event = await rejectConclusion(eventId, user.authUser.id);
      return NextResponse.json({ event });
    }

    return jsonError("Invalid conclusion action.", 400);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to process conclusion action.",
      routeErrorStatus(error),
    );
  }
}
