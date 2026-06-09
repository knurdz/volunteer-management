import "server-only";

import { AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";

export function isAppwriteNotFound(error: unknown) {
  return error instanceof AppwriteException && error.code === 404;
}

export function isAppwriteConflict(error: unknown) {
  return error instanceof AppwriteException && error.code === 409;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function routeErrorStatus(error: unknown, fallback = 400) {
  const message = error instanceof Error ? error.message : "";

  if (message === "Authentication required.") {
    return 401;
  }

  if (
    message === "Admin access required." ||
    message === "Required event role is missing." ||
    message === "You do not have access to this report." ||
    message === "You do not have access to export this report." ||
    message === "You do not have access to export this volunteer profile."
  ) {
    return 403;
  }

  if (message === "Conclusion report was not found." || message === "Volunteer profile was not found.") {
    return 404;
  }

  return fallback;
}
