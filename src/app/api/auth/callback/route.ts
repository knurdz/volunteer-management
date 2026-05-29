import { NextResponse } from "next/server";
import { getAppwriteSessionServices } from "@/server/appwrite";
import { createSessionFromOAuthToken } from "@/server/auth/oauth";
import { bootstrapProfile } from "@/server/profiles";
import { clearSessionSecret, setSessionSecret } from "@/server/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const secret = url.searchParams.get("secret");
  let sessionSecret: string | null = null;

  if (!userId || !secret) {
    return NextResponse.redirect(new URL("/login?error=missing_callback", url.origin));
  }

  try {
    const session = await createSessionFromOAuthToken({ secret, userId });

    if (!session.secret) {
      return NextResponse.redirect(new URL("/login?error=session_secret_missing", url.origin));
    }

    sessionSecret = session.secret;
    const { account } = getAppwriteSessionServices(sessionSecret);
    await bootstrapProfile(await account.get());
    await setSessionSecret(sessionSecret, session.expire);

    return NextResponse.redirect(new URL("/dashboard", url.origin));
  } catch (error) {
    if (sessionSecret) {
      try {
        const { account } = getAppwriteSessionServices(sessionSecret);
        await account.deleteSession("current");
      } catch {
        // The callback may have failed because the session was already unusable.
      }
    }

    await clearSessionSecret();
    logAuthCallbackFailure(error);
    return NextResponse.redirect(new URL("/login?error=callback_failed", url.origin));
  }
}

function logAuthCallbackFailure(error: unknown) {
  const details =
    error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          status: "code" in error ? error.code : undefined,
          type: "type" in error ? error.type : undefined,
        }
      : { message: "Unknown callback failure" };

  console.error("[auth/callback] Google OAuth callback failed", details);
}
