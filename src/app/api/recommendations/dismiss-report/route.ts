import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { dismissRecommendationReport } from "@/features/recommendations/server/recommendations";
import { jsonError, routeErrorStatus } from "@/server/errors";

const dismissSchema = z.object({
  recommendationId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = dismissSchema.parse(await request.json());
    const recommendation = await dismissRecommendationReport({
      actorUserId: admin.authUser.id,
      recommendationId: body.recommendationId,
    });

    return NextResponse.json({ recommendation });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Recommendation report dismiss failed.",
      routeErrorStatus(error),
    );
  }
}
