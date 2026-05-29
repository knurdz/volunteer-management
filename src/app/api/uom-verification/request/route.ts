import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/auth/current-user";
import { jsonError } from "@/server/errors";
import { requestUomVerification } from "@/server/uom-verification/service";

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
    return jsonError(error instanceof Error ? error.message : "Verification request failed.");
  }
}
