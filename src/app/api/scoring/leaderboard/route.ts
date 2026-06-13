import { NextResponse } from "next/server";
import { getLeaderboard } from "@/features/scoring/server/actions";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get("term") || undefined;
    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");

    const month = monthStr ? Number(monthStr) : undefined;
    const year = yearStr ? Number(yearStr) : undefined;

    const leaderboard = await getLeaderboard({ term, month, year });
    return NextResponse.json({ leaderboard });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to retrieve leaderboard.",
      routeErrorStatus(error)
    );
  }
}
