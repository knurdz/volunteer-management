import { NextResponse } from "next/server";
import { GradeRequestSchema } from "@/features/scoring/lib/schemas";
import { createGradeRequest, listGradeRequests } from "@/features/scoring/server/actions";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function POST(request: Request) {
  try {
    const body = GradeRequestSchema.parse(await request.json());
    const gradeRequest = await createGradeRequest(body);
    return NextResponse.json({ gradeRequest });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to create grade request.",
      routeErrorStatus(error)
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined;
    const gradeRequests = await listGradeRequests({ limit, offset });
    return NextResponse.json({ gradeRequests });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to list grade requests.",
      routeErrorStatus(error)
    );
  }
}
