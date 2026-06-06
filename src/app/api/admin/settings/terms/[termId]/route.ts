import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { updateIeeeTerm } from "@/features/system-settings/server/settings";
import { jsonError, routeErrorStatus } from "@/server/errors";

const updateTermSchema = z.object({
  endDate: z.string().trim().min(10).max(10),
  label: z.string().trim().min(4).max(32),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || undefined),
  startDate: z.string().trim().min(10).max(10),
  status: z.enum(["DRAFT", "CLOSED"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ termId: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { termId } = await params;
    const body = updateTermSchema.parse(await request.json());
    const term = await updateIeeeTerm({
      actorUserId: admin.authUser.id,
      termId,
      ...body,
    });

    return NextResponse.json({ term });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not update IEEE term.",
      routeErrorStatus(error),
    );
  }
}
