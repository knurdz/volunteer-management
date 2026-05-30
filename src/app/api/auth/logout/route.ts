import { NextResponse } from "next/server";
import { APPWRITE_SESSION_COOKIE } from "@/lib/appwrite/constants";
import { getAppwriteSessionServices } from "@/server/appwrite";
import { getSessionSecret } from "@/server/session";

const clearCookieOptions = {
  httpOnly: true,
  maxAge: 0,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function GET(request: Request) {
  return logout(request);
}

export async function POST(request: Request) {
  return logout(request);
}

async function logout(request: Request) {
  const sessionSecret = await getSessionSecret();

  if (sessionSecret) {
    try {
      const { account } = getAppwriteSessionServices(sessionSecret);
      await account.deleteSession("current");
    } catch {
      // Session may already be invalid; clearing the local cookie is still correct.
    }
  }

  const response = NextResponse.redirect(new URL("/login", new URL(request.url).origin), 303);
  response.cookies.set(APPWRITE_SESSION_COOKIE, "", clearCookieOptions);

  return response;
}
