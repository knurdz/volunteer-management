import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { listReportedRecommendations } from "@/features/recommendations/server/recommendations";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET() {
  try {
    await requireAdmin();
    const recommendations = await listReportedRecommendations();

    return NextResponse.json({ recommendations });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Reported recommendations lookup failed.",
      routeErrorStatus(error),
    );
  }
}
