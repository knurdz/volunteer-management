import "server-only";

import { AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

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
  if (error instanceof NotFoundError) {
    return 404;
  }

  if (error instanceof ForbiddenError) {
    return 403;
  }

  if (error instanceof ConflictError) {
    return 409;
  }

  if (error instanceof ValidationError) {
    return 400;
  }

  const message = error instanceof Error ? error.message : "";

  if (message === "Authentication required.") {
    return 401;
  }

  if (message === "Admin access required.") {
    return 403;
  }

  return fallback;
}
