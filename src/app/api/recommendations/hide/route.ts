import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { hideRecommendation } from "@/features/recommendations/server/recommendations";
import { jsonError, routeErrorStatus } from "@/server/errors";

const hideSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  recommendationId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = hideSchema.parse(await request.json());
    const recommendation = await hideRecommendation({
      actorUserId: admin.authUser.id,
      reason: body.reason,
      recommendationId: body.recommendationId,
    });

    return NextResponse.json({ recommendation });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Recommendation hide failed.",
      routeErrorStatus(error),
    );
  }
}
