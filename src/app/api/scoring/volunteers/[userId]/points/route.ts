import { NextResponse } from "next/server";
import { getVolunteerPoints } from "@/features/scoring/server/actions";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const points = await getVolunteerPoints(userId);
    return NextResponse.json({ points });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to retrieve points.",
      routeErrorStatus(error)
    );
  }
}
