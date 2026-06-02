import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { jsonError } from "@/server/errors";
import { listActiveEventRoleAssignments } from "@/features/access-control/server/roles";

export async function GET() {
  try {
    await requireAdmin();
    const assignments = await listActiveEventRoleAssignments();

    return NextResponse.json({ assignments });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Admin access failed.", 403);
  }
}
