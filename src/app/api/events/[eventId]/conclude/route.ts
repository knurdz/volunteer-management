import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  getPermissionsForUser,
  parseValidationBody,
  requireVerifiedVolunteer,
  requireVisibleEvent,
} from "@/features/events/server/event-route-helpers";
import {
  approveConclusion,
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
  const authError = requireVerifiedVolunteer(user);

  if (authError) {
    return authError;
  }

  const { eventId } = await context.params;
  const parsed = parseValidationBody(ConclusionActionSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

  try {
    const { event, userEventRole } = await requireVisibleEvent(eventId, user!);
    const permissions = getPermissionsForUser(user!, event, userEventRole);
    const { action } = parsed.data;

    if (action === "submit") {
      if (!permissions.canSubmitConclusion) {
        throw new ForbiddenError("You do not have permission to submit the conclusion.");
      }

      const updatedEvent = await submitConclusion(eventId, user!.authUser.id);
      return NextResponse.json({ event: updatedEvent });
    }

    if (action === "approve") {
      if (!permissions.canApproveConclusion) {
        throw new ForbiddenError("You do not have permission to approve the conclusion.");
      }

      const updatedEvent = await approveConclusion(eventId, user!.authUser.id);
      return NextResponse.json({ event: updatedEvent });
    }

    if (action === "reject") {
      if (!permissions.canApproveConclusion) {
        throw new ForbiddenError("You do not have permission to reject the conclusion.");
      }

      const updatedEvent = await rejectConclusion(eventId, user!.authUser.id);
      return NextResponse.json({ event: updatedEvent });
    }

    return jsonError("Invalid conclusion action.", 400);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to process conclusion action.",
      routeErrorStatus(error),
    );
  }
}
