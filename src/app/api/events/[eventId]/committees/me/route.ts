import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { requireVerifiedVolunteer } from "@/features/events/server/event-route-helpers";
import { getUserEventRole } from "@/features/events/server/committee-service";
import { getEventById } from "@/features/events/server/event-service";
import { jsonError } from "@/server/errors";

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

    const committee = await getUserEventRole(user!.authUser.id, eventId);
    return NextResponse.json({ committee });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch your event role.",
      400,
    );
  }
}
