import { NextResponse } from "next/server";
import { z } from "zod";
import { submitGradeReview } from "@/features/scoring/server/actions";
import { jsonError, routeErrorStatus } from "@/server/errors";

const patchSchema = z.object({
  gradeValue: z.number().min(0).max(100),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const gradeRequest = await submitGradeReview(id, body.gradeValue);
    return NextResponse.json({ gradeRequest });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to update grade review.",
      routeErrorStatus(error)
    );
  }
}
