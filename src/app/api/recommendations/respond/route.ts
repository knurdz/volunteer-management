import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUomVerifiedVolunteer } from "@/features/access-control/server/current-user";
import { respondToRecommendationRequest } from "@/features/recommendations/server/recommendations";
import { jsonError, routeErrorStatus } from "@/server/errors";

const respondSchema = z.object({
  requestId: z.string().min(1),
  response: z.enum(["ACCEPTED", "REJECTED"]),
  text: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUomVerifiedVolunteer();
    const body = respondSchema.parse(await request.json());
    const result = await respondToRecommendationRequest({
      requestId: body.requestId,
      response: body.response,
      text: body.text,
      user,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Recommendation response failed.",
      routeErrorStatus(error),
    );
  }
}
