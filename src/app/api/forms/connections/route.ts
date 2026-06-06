import { NextResponse } from "next/server";
import {
  createFormConnectionForCurrentUser,
  listFormConnectionsForCurrentUser,
} from "@/features/forms/server/form-connection-service";
import {
  createFormConnectionSchema,
  listFormConnectionsQuerySchema,
} from "@/features/forms/validation";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET(request: Request) {
  try {
    const query = listFormConnectionsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const connections = await listFormConnectionsForCurrentUser(query.eventId);

    return NextResponse.json({ connections });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load form connections.",
      routeErrorStatus(error),
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = createFormConnectionSchema.parse(await request.json());
    const connection = await createFormConnectionForCurrentUser(body);

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not create form connection.",
      routeErrorStatus(error),
    );
  }
}
