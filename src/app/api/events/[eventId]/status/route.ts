import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  canChangeEventStatus,
  parseValidationBody,
  requireVerifiedVolunteer,
  requireVisibleEvent,
} from "@/features/events/server/event-route-helpers";
import { updateEventStatus } from "@/features/events/server/event-service";
import { EVENT_STATUSES } from "@/features/events/types";
import { ForbiddenError, jsonError, routeErrorStatus } from "@/server/errors";

const statusUpdateSchema = z.object({
  status: z.enum(EVENT_STATUSES),
});

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
  const parsed = parseValidationBody(statusUpdateSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

  try {
    const { event } = await requireVisibleEvent(eventId, user!);

    if (
      !canChangeEventStatus({
        event,
        newStatus: parsed.data.status,
        user: user!,
      })
    ) {
      throw new ForbiddenError("You do not have permission to change this event status.");
    }

    const updatedEvent = await updateEventStatus(eventId, parsed.data.status, {
      actorUserId: user!.authUser.id,
      allowAdminBackward: user!.isAdmin,
    });

    return NextResponse.json({ event: updatedEvent });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update event status.";

    if (message.includes("Illegal event status transition")) {
      return jsonError(message, 400);
    }

    return jsonError(message, routeErrorStatus(error));
  }
}
