import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/auth/current-user";
import { jsonError } from "@/server/errors";
import { confirmUomVerification } from "@/server/uom-verification/service";

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

    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Verification confirmation failed.");
  }
}
