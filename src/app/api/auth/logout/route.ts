import { NextResponse } from "next/server";
import { getAppwriteSessionServices } from "@/server/appwrite";
import { clearSessionSecret, getSessionSecret } from "@/server/session";

export async function POST(request: Request) {
  const sessionSecret = await getSessionSecret();

  if (sessionSecret) {
    try {
      const { account } = getAppwriteSessionServices(sessionSecret);
      await account.deleteSession("current");
    } catch {
      // Session may already be invalid; clearing the local cookie is still correct.
    }
  }

  await clearSessionSecret();
  return NextResponse.redirect(new URL("/login", new URL(request.url).origin), 303);
}
