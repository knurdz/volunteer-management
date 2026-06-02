import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { jsonError, routeErrorStatus } from "@/server/errors";
import { revokeEventRole } from "@/features/access-control/server/roles";

const revokeSchema = z.object({
  assignmentId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = revokeSchema.parse(await request.json());
    const assignment = await revokeEventRole({
      actorUserId: admin.authUser.id,
      assignmentId: body.assignmentId,
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Event role revoke failed.",
      routeErrorStatus(error),
    );
  }
}
