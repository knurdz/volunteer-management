import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { jsonError, routeErrorStatus } from "@/server/errors";
import { assignEventRole, parseEventRole } from "@/features/access-control/server/roles";
import { notifyRoleAssignmentWorkflow } from "@/features/notifications/server/workflow-notifications";

const roleSchema = z.object({
  committeeName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || undefined),
  eventId: z.string().trim().min(1).max(128),
  eventTitle: z.string().trim().min(1).max(160),
  role: z.string(),
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = roleSchema.parse(await request.json());
    const assignment = await assignEventRole({
      actorUserId: admin.authUser.id,
      committeeName: body.committeeName,
      eventId: body.eventId,
      eventTitle: body.eventTitle,
      role: parseEventRole(body.role),
      userId: body.userId,
    });
    const notification = await notifyRoleAssignmentWorkflow({
      actorUserId: admin.authUser.id,
      assignment,
    });

    return NextResponse.json({ assignment, notification });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Event role assignment failed.",
      routeErrorStatus(error),
    );
  }
}
