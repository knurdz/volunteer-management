"use client";

import { Account, Client, Storage, TablesDB } from "appwrite";
import { getPublicEnv } from "@/lib/env";

let client: Client | null = null;

export function getAppwriteClient() {
  if (client) {
    return client;
  }

  const env = getPublicEnv();

  client = new Client()
    .setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

  return client;
}

export function getAppwriteBrowserServices() {
  const appwriteClient = getAppwriteClient();

  return {
    account: new Account(appwriteClient),
    storage: new Storage(appwriteClient),
    tables: new TablesDB(appwriteClient),
  };
}
