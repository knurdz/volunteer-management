import { NextResponse } from "next/server";
import { z } from "zod";
import { finalizeGrade } from "@/features/scoring/server/actions";
import { jsonError, routeErrorStatus } from "@/server/errors";

const finalizeSchema = z.object({
  gradeRequestId: z.string().min(1),
  conclusionApprovalDate: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = finalizeSchema.parse(await request.json());
    const gradeRequest = await finalizeGrade(body.gradeRequestId, body.conclusionApprovalDate);
    return NextResponse.json({ gradeRequest });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to finalize grade.",
      routeErrorStatus(error)
    );
  }
}
