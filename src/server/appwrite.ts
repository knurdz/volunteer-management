import "server-only";

import { Client, Messaging, Storage, TablesDB, Users } from "node-appwrite";
import { getServerEnv } from "@/lib/env";

export function getAppwriteAdminClient() {
  const env = getServerEnv();

  return new Client()
    .setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY);
}

export function getAppwriteAdminServices() {
  const client = getAppwriteAdminClient();

  return {
    messaging: new Messaging(client),
    storage: new Storage(client),
    tables: new TablesDB(client),
    users: new Users(client),
  };
}
