import { NextResponse } from "next/server";
import { requireAuth } from "@/features/access-control/server/current-user";
import { getVolunteerProfileSummary } from "@/features/volunteers/server/profiles";
import { listVisibleRecommendationsForVolunteer } from "@/features/recommendations/server/recommendations";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAuth();
    const { userId } = await params;
    const profile = await getVolunteerProfileSummary(userId);

    if (!profile) {
      return jsonError("Volunteer profile was not found.", 404);
    }

    const recommendations = await listVisibleRecommendationsForVolunteer(userId);

    return NextResponse.json({ profile, recommendations });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Volunteer profile lookup failed.",
      routeErrorStatus(error),
    );
  }
}
