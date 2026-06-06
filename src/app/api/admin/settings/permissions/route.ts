import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { getPermissionOverview } from "@/features/system-settings/server/settings";
import { getServerEnv } from "@/lib/env";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET() {
  try {
    await requireAdmin();
    const permissions = getPermissionOverview(getServerEnv().ADMIN_EMAIL);

    return NextResponse.json({ permissions });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load permission overview.",
      routeErrorStatus(error),
    );
  }
}
