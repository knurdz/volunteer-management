import { NextResponse } from "next/server";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  canChangeEventStatus,
  getEventUserContext,
  getPermissionsForUser,
  isEventVisible,
  parseValidationBody,
} from "@/features/events/server/event-route-helpers";
import {
  deleteEvent,
  getEventById,
  getEventWithCommittees,
  updateEvent,
  updateEventStatus,
} from "@/features/events/server/event-service";
import { UpdateEventInputSchema } from "@/features/events/types";
import { jsonError } from "@/server/errors";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    return jsonError("Verified UoM email is required before volunteering.", 403);
  }

  const { eventId } = await context.params;

  try {
    const event = await getEventWithCommittees(eventId);

    if (!event) {
      return jsonError("Event was not found.", 404);
    }

    const { userCommitteeRole } = await getEventUserContext(eventId, user);

    if (!isEventVisible(user, event, userCommitteeRole)) {
      return jsonError("Event was not found.", 404);
    }

    return NextResponse.json({ event });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch event.",
      400,
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    return jsonError("Verified UoM email is required before volunteering.", 403);
  }

  const { eventId } = await context.params;
  const parsed = parseValidationBody(UpdateEventInputSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

  try {
    const existingEvent = await getEventById(eventId);

    if (!existingEvent) {
      return jsonError("Event was not found.", 404);
    }

    const { userCommitteeRole } = await getEventUserContext(eventId, user);

    if (!isEventVisible(user, existingEvent, userCommitteeRole)) {
      return jsonError("Event was not found.", 404);
    }

    const permissions = getPermissionsForUser(user, existingEvent, userCommitteeRole);
    const { status, ...fieldUpdates } = parsed.data;
    const hasFieldUpdates = Object.keys(fieldUpdates).length > 0;

    if (hasFieldUpdates && !permissions.canEdit) {
      return jsonError("You do not have permission to edit this event.", 403);
    }

    if (status) {
      if (
        !canChangeEventStatus({
          event: existingEvent,
          newStatus: status,
          user,
          userCommitteeRole,
        })
      ) {
        return jsonError("You do not have permission to change this event status.", 403);
      }

      await updateEventStatus(eventId, status, { allowAdminBackward: user.isAdmin });
    }

    const event =
      hasFieldUpdates && permissions.canEdit
        ? await updateEvent(eventId, fieldUpdates)
        : await getEventById(eventId);

    if (!event) {
      return jsonError("Event was not found.", 404);
    }

    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update event.";

    if (message.includes("Illegal event status transition")) {
      return jsonError(message, 400);
    }

    return jsonError(message, 400);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  if (!user.isAdmin) {
    return jsonError("Admin access required.", 403);
  }

  const { eventId } = await context.params;

  try {
    const existingEvent = await getEventById(eventId);

    if (!existingEvent) {
      return jsonError("Event was not found.", 404);
    }

    await deleteEvent(eventId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to delete event.",
      400,
    );
  }
}
