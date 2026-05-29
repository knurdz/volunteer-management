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
