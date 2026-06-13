import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteGradeRequest, submitGradeReview } from "@/features/scoring/server/actions";
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteGradeRequest(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to delete grade request.",
      routeErrorStatus(error)
    );
  }
}
