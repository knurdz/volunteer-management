import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/features/access-control/server/current-user";
import {
  createIeeeTerm,
  listIeeeTerms,
} from "@/features/system-settings/server/settings";
import { jsonError, routeErrorStatus } from "@/server/errors";

const createTermSchema = z.object({
  endDate: z.string().trim().min(10).max(10),
  label: z.string().trim().min(4).max(32),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || undefined),
  startDate: z.string().trim().min(10).max(10),
});

export async function GET() {
  try {
    await requireAdmin();
    const terms = await listIeeeTerms();

    return NextResponse.json({ terms });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load IEEE terms.",
      routeErrorStatus(error),
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = createTermSchema.parse(await request.json());
    const term = await createIeeeTerm({
      actorUserId: admin.authUser.id,
      ...body,
    });

    return NextResponse.json({ term });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not create IEEE term.",
      routeErrorStatus(error),
    );
  }
}
