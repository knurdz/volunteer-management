import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/features/access-control/server/current-user";
import { jsonError, routeErrorStatus } from "@/server/errors";
import { confirmUomVerification } from "@/features/access-control/server/uom-verification";
import { notifyVerificationWorkflow } from "@/features/notifications/server/workflow-notifications";

const confirmSchema = z.object({
  code: z.string().min(4).max(12),
  requestId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = confirmSchema.parse(await request.json());
    const profile = await confirmUomVerification({
      code: body.code,
      requestId: body.requestId,
      userId: user.authUser.id,
    });
    const notification = await notifyVerificationWorkflow({
      actorUserId: user.authUser.id,
      recipientUserId: user.authUser.id,
      verified: true,
    });

    return NextResponse.json({ notification, profile });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Verification confirmation failed.",
      routeErrorStatus(error),
    );
  }
}
