import "server-only";

import { cookies } from "next/headers";
import { APPWRITE_SESSION_COOKIE } from "@/lib/appwrite/constants";

const cookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function getSessionSecret() {
  const cookieStore = await cookies();
  return cookieStore.get(APPWRITE_SESSION_COOKIE)?.value;
}

export async function setSessionSecret(sessionSecret: string, expiresAt?: string) {
  const cookieStore = await cookies();
  cookieStore.set(APPWRITE_SESSION_COOKIE, sessionSecret, {
    ...cookieOptions,
    expires: expiresAt ? new Date(expiresAt) : undefined,
  });
}

export async function clearSessionSecret() {
  const cookieStore = await cookies();
  cookieStore.set(APPWRITE_SESSION_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}
