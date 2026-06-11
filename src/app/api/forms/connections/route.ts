import { NextResponse } from "next/server";
import {
  createFormConnectionForCurrentUser,
  listFormConnectionsForCurrentUser,
} from "@/features/forms/server/form-connection-service";
import { listProfiles } from "@/features/access-control/server/profiles";
import { requireAuth } from "@/features/access-control/server/current-user";
import { listActiveEventRoleAssignments } from "@/features/access-control/server/roles";
import {
  createFormConnectionSchema,
  listFormConnectionsQuerySchema,
} from "@/features/forms/validation";
import {
  notifyEventUpdateWorkflow,
  notifyGradingRequestWorkflow,
} from "@/features/notifications/server/workflow-notifications";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET(request: Request) {
  try {
    const query = listFormConnectionsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const connections = await listFormConnectionsForCurrentUser(query.eventId);

    return NextResponse.json({ connections });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load form connections.",
      routeErrorStatus(error),
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = createFormConnectionSchema.parse(await request.json());
    const connection = await createFormConnectionForCurrentUser(body, user);
    const notificationContext = await getActiveVerifiedEventNotificationContext(
      connection.eventId,
    );
    const notifications =
      connection.purpose === "grading"
        ? await notifyGradingRequestWorkflow({
            actorUserId: user.authUser.id,
            eventId: connection.eventId,
            eventTitle: notificationContext.eventTitle,
            linkHref: "/dashboard",
            recipientUserIds: notificationContext.recipientUserIds,
          })
        : await notifyEventUpdateWorkflow({
            actorUserId: user.authUser.id,
            eventId: connection.eventId,
            eventTitle: notificationContext.eventTitle,
            linkHref: "/dashboard",
            message: `${connection.title} is now available.`,
            recipientUserIds: notificationContext.recipientUserIds,
          });

    return NextResponse.json({ connection, notifications }, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not create form connection.",
      routeErrorStatus(error),
    );
  }
}

async function getActiveVerifiedEventNotificationContext(eventId: string) {
  const [assignments, profiles] = await Promise.all([
    listActiveEventRoleAssignments(),
    listProfiles(),
  ]);
  const eventAssignments = assignments.filter(
    (assignment) => assignment.eventId === eventId,
  );
  const activeVerifiedProfileIds = new Set(
    profiles
      .filter((profile) => profile.status === "ACTIVE" && profile.uomVerified)
      .map((profile) => profile.authUserId),
  );

  return {
    eventTitle: eventAssignments[0]?.eventTitle ?? eventId,
    recipientUserIds: [
      ...new Set(
        eventAssignments
          .filter((assignment) => activeVerifiedProfileIds.has(assignment.userId))
          .map((assignment) => assignment.userId),
      ),
    ],
  };
}
