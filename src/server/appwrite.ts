import "server-only";

import { Account, Client, Messaging, Storage, TablesDB, Users } from "node-appwrite";
import { getServerEnv } from "@/lib/env";

export function getAppwriteBaseClient() {
  const env = getServerEnv();

  return new Client()
    .setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
}

export function getAppwriteAdminClient() {
  const env = getServerEnv();

  return getAppwriteBaseClient().setKey(env.APPWRITE_API_KEY);
}

export function getAppwriteSessionClient(sessionSecret: string) {
  return getAppwriteBaseClient().setSession(sessionSecret);
}

export function getAppwriteAdminServices() {
  const client = getAppwriteAdminClient();

  return {
    account: new Account(client),
    messaging: new Messaging(client),
    storage: new Storage(client),
    tables: new TablesDB(client),
    users: new Users(client),
  };
}

export function getAppwriteSessionServices(sessionSecret: string) {
  const client = getAppwriteSessionClient(sessionSecret);

  return {
    account: new Account(client),
    tables: new TablesDB(client),
  };
}
