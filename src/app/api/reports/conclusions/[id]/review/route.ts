import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { approveConclusionReportSchema } from "@/features/reports/lib/validation";
import { reviewConclusionReportRecord } from "@/features/reports/server/conclusion-service";
import { jsonError, routeErrorStatus } from "@/server/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = approveConclusionReportSchema.parse(await request.json());
    const result = await reviewConclusionReportRecord(admin, id, body);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Conclusion report review failed.",
      routeErrorStatus(error),
    );
  }
}
