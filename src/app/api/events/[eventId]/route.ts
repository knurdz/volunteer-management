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
  filterUpdateInputForRole,
  getEventById,
  getEventWithRoleAssignments,
  updateEvent,
  updateEventStatus,
} from "@/features/events/server/event-service";
import { UpdateEventInputSchema } from "@/features/events/types";
import { ForbiddenError, jsonError, routeErrorStatus } from "@/server/errors";

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
    const event = await getEventWithRoleAssignments(eventId);

    if (!event) {
      return jsonError("Event was not found.", 404);
    }

    const { userEventRole } = await getEventUserContext(eventId, user);

    if (!isEventVisible(user, event, userEventRole)) {
      return jsonError("Event was not found.", 404);
    }

    return NextResponse.json({ event });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch event.",
      routeErrorStatus(error),
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

    const { userEventRole } = await getEventUserContext(eventId, user);

    if (!isEventVisible(user, existingEvent, userEventRole)) {
      return jsonError("Event was not found.", 404);
    }

    const permissions = getPermissionsForUser(user, existingEvent, userEventRole);
    const filteredInput = filterUpdateInputForRole(parsed.data, { isAdmin: user.isAdmin });
    const { status, ...fieldUpdates } = filteredInput;
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
          userEventRole,
        })
      ) {
        return jsonError("You do not have permission to change this event status.", 403);
      }

      await updateEventStatus(eventId, status, {
        actorUserId: user.authUser.id,
        allowAdminBackward: user.isAdmin,
      });
    }

    const event =
      hasFieldUpdates && permissions.canEdit
        ? await updateEvent(eventId, fieldUpdates, user.authUser.id)
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

    return jsonError(message, routeErrorStatus(error));
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

    await deleteEvent(eventId, user.authUser.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError(error.message, 403);
    }

    return jsonError(
      error instanceof Error ? error.message : "Failed to delete event.",
      routeErrorStatus(error),
    );
  }
}
