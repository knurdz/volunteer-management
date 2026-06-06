import { NextResponse } from "next/server";
import { requireAuth } from "@/features/access-control/server/current-user";
import {
  adminReopenConclusionReportSchema,
  updateConclusionReportSchema,
} from "@/features/reports/lib/validation";
import {
  canViewConclusionReport,
  getConclusionReport,
  reopenConclusionReportRecord,
  updateConclusionReportRecord,
} from "@/features/reports/server/conclusion-service";
import { jsonError, routeErrorStatus } from "@/server/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const report = await getConclusionReport(id);

    if (!report) {
      return jsonError("Conclusion report was not found.", 404);
    }

    if (!canViewConclusionReport(user, report)) {
      return jsonError("You do not have access to this report.", 403);
    }

    return NextResponse.json({ report });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load conclusion report.",
      routeErrorStatus(error),
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();

    if (body?.status === "DRAFT" && Object.keys(body).length === 1) {
      const parsed = adminReopenConclusionReportSchema.parse(body);
      const report = await reopenConclusionReportRecord(user, id);

      return NextResponse.json({ report, action: parsed.status });
    }

    const input = updateConclusionReportSchema.parse(body);
    const report = await updateConclusionReportRecord(user, id, input);

    return NextResponse.json({ report });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not update conclusion report.",
      routeErrorStatus(error),
    );
  }
}
