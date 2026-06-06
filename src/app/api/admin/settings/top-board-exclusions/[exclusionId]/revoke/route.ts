import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { revokeTopBoardExclusion } from "@/features/system-settings/server/top-board-exclusions";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ exclusionId: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { exclusionId } = await params;
    const exclusion = await revokeTopBoardExclusion({
      actorUserId: admin.authUser.id,
      exclusionId,
    });

    return NextResponse.json({ exclusion });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not revoke Top Board exclusion.",
      routeErrorStatus(error),
    );
  }
}
