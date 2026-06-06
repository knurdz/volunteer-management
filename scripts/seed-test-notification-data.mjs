import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

process.env.FORCE_NODE_FETCH ??= "1";

const envFiles = [".env.local", ".env"];

for (const envFile of envFiles) {
  const envPath = path.join(process.cwd(), envFile);

  if (!existsSync(envPath)) {
    continue;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
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
  "NEXT_PUBLIC_APPWRITE_DATABASE_ID",
  "APPWRITE_API_KEY",
];

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required env values: ${missing.join(", ")}`);
  process.exit(1);
}

const { Client, TablesDB } = await import("node-appwrite");

const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const tables = new TablesDB(client);

const testUsers = [
  {
    email: "a.r.s.praveenfernando@gmail.com",
    id: "test_praveen_fernando",
    name: "Test Praveen Fernando",
  },
  {
    email: "fassainssin@gmail.com",
    id: "test_fassainssin",
    name: "Test Fassainssin",
  },
];

const event = {
  eventId: "test_event",
  eventTitle: "test_event",
};

async function upsertRow(tableId, rowId, payload) {
  try {
    await tables.getRow(databaseId, tableId, rowId);
    await tables.updateRow(databaseId, tableId, rowId, payload);
    console.log(`updated ${tableId}.${rowId}`);
  } catch (error) {
    if (error?.code !== 404) {
      throw error;
    }

    await tables.createRow(databaseId, tableId, rowId, payload);
    console.log(`created ${tableId}.${rowId}`);
  }
}

async function seedProfiles() {
  const now = new Date().toISOString();

  for (const user of testUsers) {
    await upsertRow("profiles", user.id, {
      authUserId: user.id,
      googleEmail: user.email,
      lastLoginAt: now,
      name: user.name,
      status: "ACTIVE",
      uomEmail: user.email,
      uomVerified: true,
      uomVerifiedAt: now,
    });
  }
}

async function seedEventAssignments() {
  const now = new Date().toISOString();

  for (const user of testUsers) {
    await upsertRow("event_role_assignments", `test_event_${user.id}`, {
      active: true,
      assignedAt: now,
      assignedBy: "seed_test_data",
      committeeName: "Testing",
      eventId: event.eventId,
      eventTitle: event.eventTitle,
      role: "Committee Member",
      userId: user.id,
    });
  }
}

async function main() {
  await seedProfiles();
  await seedEventAssignments();
  console.log("Seeded test_event recipients:");
  for (const user of testUsers) {
    console.log(`- ${user.name} <${user.email}> as ${user.id}`);
  }
}

main().catch((error) => {
  if (error?.code === 404) {
    console.error(
      "Required table was not found. Run `npm run setup:appwrite` first, then rerun this seed.",
    );
  } else {
    console.error(error);
  }

  process.exit(1);
});
