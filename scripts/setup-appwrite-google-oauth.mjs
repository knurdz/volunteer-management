import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

process.env.FORCE_NODE_FETCH ??= "1";

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(process.cwd(), envFile);

  if (!existsSync(envPath)) {
    continue;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [rawKey, ...valueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = valueParts.join("=").trim();

    if (!process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

const requiredEnv = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
];

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required env values: ${missing.join(", ")}`);
  console.error("");
  console.error("Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET from a Google Web OAuth client.");
  console.error("Then rerun: npm run setup:appwrite:oauth");
  console.error("");
  console.error(`Google authorized redirect URI: ${getGoogleRedirectUri()}`);
  process.exit(1);
}

const { Client, Project, ProjectOAuth2GooglePrompt } = await import("node-appwrite");

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const project = new Project(client);

try {
  const provider = await project.updateOAuth2Google({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    enabled: true,
    prompt: [ProjectOAuth2GooglePrompt.SelectAccount, ProjectOAuth2GooglePrompt.Consent],
  });

  console.log("Google OAuth provider updated in Appwrite.");
  console.log(`enabled: ${String(provider.enabled)}`);
  console.log(`clientId: ${maskClientId(provider.clientId)}`);
  console.log(`Google authorized redirect URI: ${getGoogleRedirectUri()}`);
} catch (error) {
  console.error("Unable to update Appwrite Google OAuth provider.");
  console.error(error instanceof Error ? error.message : "Unknown Appwrite error");
  console.error("");
  console.error("Check that APPWRITE_API_KEY has project/auth provider permissions.");
  console.error(`Google authorized redirect URI: ${getGoogleRedirectUri()}`);
  process.exit(1);
}

function getGoogleRedirectUri() {
  const endpoint = String(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "").replace(/\/$/, "");
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "<APPWRITE_PROJECT_ID>";

  return `${endpoint}/account/sessions/oauth2/callback/google/${projectId}`;
}

function maskClientId(clientId) {
  if (!clientId || clientId.length < 16) {
    return "set";
  }

  return `${clientId.slice(0, 8)}...${clientId.slice(-12)}`;
}
