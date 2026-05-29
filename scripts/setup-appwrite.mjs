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

const { Client, Databases, TablesDB, TablesDBIndexType } = await import("node-appwrite");

const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const tables = new TablesDB(client);

const tableDefinitions = [
  {
    id: "profiles",
    name: "Profiles",
    columns: [
      ["string", "authUserId", 64, true],
      ["email", "googleEmail", true],
      ["string", "name", 128, false],
      ["email", "uomEmail", false],
      ["boolean", "uomVerified", false, false],
      ["datetime", "uomVerifiedAt", false],
      ["enum", "status", ["ACTIVE", "DISABLED"], false, "ACTIVE"],
      ["datetime", "lastLoginAt", false],
    ],
    indexes: [
      ["profiles_google_email_idx", ["googleEmail"]],
      ["profiles_uom_email_idx", ["uomEmail"]],
    ],
  },
  {
    id: "uom_verification_requests",
    name: "UoM Verification Requests",
    columns: [
      ["string", "userId", 64, true],
      ["email", "uomEmail", true],
      ["string", "codeHash", 128, true],
      ["datetime", "expiresAt", true],
      ["integer", "attempts", false, 0],
      ["enum", "status", ["PENDING", "VERIFIED", "EXPIRED", "CANCELLED"], false, "PENDING"],
      ["datetime", "verifiedAt", false],
    ],
    indexes: [
      ["uom_verification_user_idx", ["userId"]],
      ["uom_verification_status_idx", ["status"]],
      ["uom_verification_email_idx", ["uomEmail"]],
    ],
  },
  {
    id: "sb_role_assignments",
    name: "SB Role Assignments",
    columns: [
      ["string", "userId", 64, true],
      ["enum", "role", ["ExCom", "SB Lead", "SB Member"], true],
      ["string", "assignedBy", 64, true],
      ["datetime", "assignedAt", true],
      ["datetime", "revokedAt", false],
      ["boolean", "active", false, true],
    ],
    indexes: [
      ["sb_roles_user_idx", ["userId"]],
      ["sb_roles_role_idx", ["role"]],
      ["sb_roles_active_idx", ["active"]],
    ],
  },
  {
    id: "audit_logs",
    name: "Audit Logs",
    columns: [
      ["string", "actorUserId", 64, false],
      ["string", "action", 64, true],
      ["string", "targetType", 64, true],
      ["string", "targetId", 128, true],
      ["string", "metadata", 4000, false],
      ["datetime", "createdAt", true],
    ],
    indexes: [
      ["audit_target_idx", ["targetId"]],
      ["audit_action_idx", ["action"]],
      ["audit_created_at_idx", ["createdAt"]],
    ],
  },
];

async function ignoreAlreadyExists(action, label) {
  try {
    await action();
    console.log(`created ${label}`);
  } catch (error) {
    if (error?.code === 409) {
      console.log(`exists ${label}`);
      return;
    }

    throw error;
  }
}

async function ensureDatabase() {
  try {
    await databases.get(databaseId);
    console.log(`exists database ${databaseId}`);
  } catch (error) {
    if (error?.code !== 404) {
      throw error;
    }

    await databases.create(databaseId, "Volunteer Management");
    console.log(`created database ${databaseId}`);
  }
}

async function createColumn(tableId, column) {
  const [kind, key, ...rest] = column;
  const label = `${tableId}.${key}`;

  await ignoreAlreadyExists(async () => {
    if (kind === "string") {
      const [size, required] = rest;
      await tables.createStringColumn(databaseId, tableId, key, size, required);
      return;
    }

    if (kind === "email") {
      const [required] = rest;
      await tables.createEmailColumn(databaseId, tableId, key, required);
      return;
    }

    if (kind === "boolean") {
      const [required, defaultValue] = rest;
      await tables.createBooleanColumn(databaseId, tableId, key, required, defaultValue);
      return;
    }

    if (kind === "datetime") {
      const [required] = rest;
      await tables.createDatetimeColumn(databaseId, tableId, key, required);
      return;
    }

    if (kind === "integer") {
      const [required, defaultValue] = rest;
      await tables.createIntegerColumn(
        databaseId,
        tableId,
        key,
        required,
        undefined,
        undefined,
        defaultValue,
      );
      return;
    }

    if (kind === "enum") {
      const [elements, required, defaultValue] = rest;
      await tables.createEnumColumn(
        databaseId,
        tableId,
        key,
        elements,
        required,
        defaultValue,
      );
      return;
    }

    throw new Error(`Unsupported column type: ${kind}`);
  }, `column ${label}`);
}

async function waitForColumns(tableId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const table = await tables.getTable(databaseId, tableId);
    const processing = table.columns.filter((column) => column.status === "processing");

    if (processing.length === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function main() {
  await ensureDatabase();

  for (const table of tableDefinitions) {
    await ignoreAlreadyExists(
      () => tables.createTable(databaseId, table.id, table.name, [], false, true),
      `table ${table.id}`,
    );

    for (const column of table.columns) {
      await createColumn(table.id, column);
    }

    await waitForColumns(table.id);

    for (const [indexId, columns] of table.indexes) {
      await ignoreAlreadyExists(
        () =>
          tables.createIndex(
            databaseId,
            table.id,
            indexId,
            TablesDBIndexType.Key,
            columns,
          ),
        `index ${table.id}.${indexId}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
