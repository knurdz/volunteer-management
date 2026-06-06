import { NextResponse } from "next/server";
import { z } from "zod";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  canChangeEventStatus,
  getEventUserContext,
  isEventVisible,
  parseValidationBody,
} from "@/features/events/server/event-route-helpers";
import { getEventById, updateEventStatus } from "@/features/events/server/event-service";
import { EVENT_STATUSES } from "@/features/events/types";
import { jsonError } from "@/server/errors";

const statusUpdateSchema = z.object({
  status: z.enum(EVENT_STATUSES),
});

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
  const parsed = parseValidationBody(statusUpdateSchema, await request.json());

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

    if (
      !canChangeEventStatus({
        event: existingEvent,
        newStatus: parsed.data.status,
        user,
        userEventRole,
      })
    ) {
      return jsonError("You do not have permission to change this event status.", 403);
    }

    const event = await updateEventStatus(eventId, parsed.data.status, {
      actorUserId: user.authUser.id,
      allowAdminBackward: user.isAdmin,
    });

    return NextResponse.json({ event });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update event status.";

    if (message.includes("Illegal event status transition")) {
      return jsonError(message, 400);
    }

    return jsonError(message, 400);
  }
}
