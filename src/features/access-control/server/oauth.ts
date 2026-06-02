import "server-only";

import { Account, OAuthProvider } from "node-appwrite";
import { getAppwriteAdminClient, getAppwriteBaseClient } from "@/server/appwrite";

export function getOAuthAccount() {
  return new Account(getAppwriteBaseClient());
}

export function getOAuthSessionAccount() {
  return new Account(getAppwriteAdminClient());
}

export async function createGoogleOAuthUrl(origin: string) {
  const account = getOAuthAccount();

  return account.createOAuth2Token({
    failure: `${origin}/login?error=oauth_failed`,
    provider: OAuthProvider.Google,
    scopes: ["email", "profile"],
    success: `${origin}/api/auth/callback`,
  });
}

export async function createSessionFromOAuthToken({
  secret,
  userId,
}: {
  secret: string;
  userId: string;
}) {
  const account = getOAuthSessionAccount();
  return account.createSession({ secret, userId });
}
