import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/features/access-control/server/current-user";
import { jsonError, routeErrorStatus } from "@/server/errors";
import { requestUomVerification } from "@/features/access-control/server/uom-verification";

const requestSchema = z.object({
  uomEmail: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = requestSchema.parse(await request.json());
    const result = await requestUomVerification({
      uomEmail: body.uomEmail,
      userId: user.authUser.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Verification request failed.",
      routeErrorStatus(error),
    );
  }
}
