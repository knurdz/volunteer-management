import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUomVerifiedVolunteer } from "@/features/access-control/server/current-user";
import { reportRecommendation } from "@/features/recommendations/server/recommendations";
import { jsonError, routeErrorStatus } from "@/server/errors";

const reportSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  recommendationId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUomVerifiedVolunteer();
    const body = reportSchema.parse(await request.json());
    const recommendation = await reportRecommendation({
      actorUserId: user.authUser.id,
      reason: body.reason,
      recommendationId: body.recommendationId,
    });

    return NextResponse.json({ recommendation });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Recommendation report failed.",
      routeErrorStatus(error),
    );
  }
}
