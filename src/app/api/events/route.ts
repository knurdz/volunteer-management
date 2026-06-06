import { NextResponse } from "next/server";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  canCreateEvent,
  parseEventStatus,
  parseValidationBody,
  VOLUNTEER_VISIBLE_STATUSES,
} from "@/features/events/server/event-route-helpers";
import { createEvent, listEvents } from "@/features/events/server/event-service";
import { CreateEventInputSchema } from "@/features/events/types";
import { jsonError } from "@/server/errors";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    return jsonError("Verified UoM email is required before volunteering.", 403);
  }

  const { searchParams } = new URL(request.url);
  const status = parseEventStatus(searchParams.get("status"));
  const term = searchParams.get("term")?.trim() || undefined;

  if (searchParams.get("status") && !status) {
    return jsonError("Invalid event status filter.", 400);
  }

  try {
    if (user.isAdmin) {
      const events = await listEvents({ status, term });
      return NextResponse.json({ events });
    }

    if (status && !VOLUNTEER_VISIBLE_STATUSES.includes(status)) {
      return NextResponse.json({ events: [] });
    }

    const events = await listEvents({ status, term });
    const visibleEvents = events.filter((event) =>
      VOLUNTEER_VISIBLE_STATUSES.includes(event.status),
    );

    return NextResponse.json({ events: visibleEvents });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to list events.",
      400,
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  if (!canCreateEvent(user)) {
    return jsonError("Required Student Branch role is missing.", 403);
  }

  const parsed = parseValidationBody(CreateEventInputSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

  try {
    const event = await createEvent(parsed.data, user.authUser.id);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to create event.",
      400,
    );
  }
}
