import { NextResponse } from "next/server";
import { markNotificationsReadForCurrentUser } from "@/features/notifications/server/notification-service";
import { markNotificationsReadSchema } from "@/features/notifications/validation";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function POST(request: Request) {
  try {
    const body = markNotificationsReadSchema.parse(await request.json());
    const notifications = await markNotificationsReadForCurrentUser(body.notificationIds);

    return NextResponse.json({ notifications });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not mark notifications read.",
      routeErrorStatus(error),
    );
  }
}
