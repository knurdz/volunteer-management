import { NextResponse } from "next/server";
import { createGoogleOAuthUrl } from "@/server/auth/oauth";
import { jsonError } from "@/server/errors";

export async function GET(request: Request) {
  try {
    const authUrl = await createGoogleOAuthUrl(new URL(request.url).origin);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to start Google login.",
      500,
    );
  }
}
