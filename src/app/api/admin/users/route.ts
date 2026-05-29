import { NextResponse } from "next/server";
import { listAdminUsers } from "@/server/admin/users";
import { requireAdmin } from "@/server/auth/current-user";
import { jsonError } from "@/server/errors";

export async function GET() {
  try {
    await requireAdmin();
    const users = await listAdminUsers();

    return NextResponse.json({ users });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Admin access failed.", 403);
  }
}
