import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/features/access-control/server/current-user";
import {
  addTopBoardExclusion,
  listTopBoardExclusions,
} from "@/features/system-settings/server/top-board-exclusions";
import { jsonError, routeErrorStatus } from "@/server/errors";

const exclusionSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  termId: z.string().min(1),
  userId: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const termId = searchParams.get("termId")?.trim() || undefined;
    const exclusions = await listTopBoardExclusions(termId);

    return NextResponse.json({ exclusions });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load Top Board exclusions.",
      routeErrorStatus(error),
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = exclusionSchema.parse(await request.json());
    const exclusion = await addTopBoardExclusion({
      actorUserId: admin.authUser.id,
      ...body,
    });

    return NextResponse.json({ exclusion });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not add Top Board exclusion.",
      routeErrorStatus(error),
    );
  }
}
