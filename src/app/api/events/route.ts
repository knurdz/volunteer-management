import { NextResponse } from "next/server";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  canCreateEvent,
  parseEventStatus,
  parseValidationBody,
} from "@/features/events/server/event-route-helpers";
import { createEvent, getEvents } from "@/features/events/server/event-service";
import { CreateEventInputSchema } from "@/features/events/types";
import { jsonError, routeErrorStatus } from "@/server/errors";

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
  const limit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);

  if (searchParams.get("status") && !status) {
    return jsonError("Invalid event status filter.", 400);
  }

  try {
    const result = await getEvents({
      isAdmin: user.isAdmin,
      limit: Number.isNaN(limit) ? 50 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
      status,
      term,
      userId: user.authUser.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to list events.",
      routeErrorStatus(error),
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
    const event = await createEvent(parsed.data, user.authUser.id, {
      isAdmin: user.isAdmin,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to create event.",
      routeErrorStatus(error),
    );
  }
}
