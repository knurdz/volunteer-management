import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/current-user";
import { jsonError } from "@/server/errors";
import { parseSbRole, revokeSbRole } from "@/server/roles";

const roleSchema = z.object({
  role: z.string(),
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = roleSchema.parse(await request.json());
    const assignment = await revokeSbRole({
      actorUserId: admin.authUser.id,
      role: parseSbRole(body.role),
      userId: body.userId,
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Role revoke failed.", 400);
  }
}
