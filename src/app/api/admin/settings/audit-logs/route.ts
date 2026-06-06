import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { listAuditLogs } from "@/features/system-settings/server/settings";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const auditLogs = await listAuditLogs({
      action: searchParams.get("action")?.trim() || undefined,
      actorUserId: searchParams.get("actorUserId")?.trim() || undefined,
      dateFrom: searchParams.get("dateFrom")?.trim() || undefined,
      dateTo: searchParams.get("dateTo")?.trim() || undefined,
      targetId: searchParams.get("targetId")?.trim() || undefined,
    });

    return NextResponse.json({ auditLogs });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load audit logs.",
      routeErrorStatus(error),
    );
  }
}
