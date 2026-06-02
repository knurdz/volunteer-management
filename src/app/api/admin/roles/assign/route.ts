import { NextResponse } from "next/server";
import { z } from "zod";
import { parseSbRole, assignSbRole } from "@/features/access-control/server/roles";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { jsonError, routeErrorStatus } from "@/server/errors";

const roleSchema = z.object({
  role: z.string(),
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = roleSchema.parse(await request.json());
    const assignment = await assignSbRole({
      actorUserId: admin.authUser.id,
      role: parseSbRole(body.role),
      userId: body.userId,
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Role assignment failed.",
      routeErrorStatus(error),
    );
  }
}
