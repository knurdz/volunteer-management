import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import {
  createNotification,
  listNotificationsForCurrentUser,
} from "@/features/notifications/server/notification-service";
import {
  checkTrustedNotificationToken,
  getProvidedTrustedNotificationToken,
} from "@/features/notifications/server/trusted-creation";
import {
  createNotificationSchema,
  listNotificationsQuerySchema,
} from "@/features/notifications/validation";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET(request: Request) {
  try {
    const query = listNotificationsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const result = await listNotificationsForCurrentUser({ limit: query.limit });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load notifications.",
      routeErrorStatus(error),
    );
  }
}

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    const trusted = checkTrustedNotificationToken({
      configuredToken: env.INTERNAL_JOB_TOKEN,
      providedToken: getProvidedTrustedNotificationToken(request.headers),
    });

    if (!trusted.ok) {
      return jsonError(trusted.message, trusted.status);
    }

    const body = createNotificationSchema.parse(await request.json());
    const result = await createNotification(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Notification creation failed.",
      routeErrorStatus(error),
    );
  }
}
