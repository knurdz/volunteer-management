import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { activateIeeeTerm } from "@/features/system-settings/server/settings";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ termId: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { termId } = await params;
    const term = await activateIeeeTerm({
      actorUserId: admin.authUser.id,
      termId,
    });

    return NextResponse.json({ term });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not activate IEEE term.",
      routeErrorStatus(error),
    );
  }
}
