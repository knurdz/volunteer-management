import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  canListFormConnections,
  canManageFormConnections,
} from "../src/features/forms/server/permissions";
import { createFormConnectionService } from "../src/features/forms/server/form-connection-service";
import { createFormConnectionSchema } from "../src/features/forms/validation";
import type { FormConnectionRepository } from "../src/features/forms/server/form-connection-repository";
import type {
  CreateFormConnectionInput,
  FormConnection,
} from "../src/features/forms/types";
import type { SessionUser } from "../src/features/access-control/types";

describe("form connections", () => {
  it("stores external form references instead of builder definitions", async () => {
    const repository = createFakeFormConnectionRepository();
    const service = createFormConnectionService({
      now: fixedNow,
      repository,
    });

    const connection = await service.createFormConnection({
      input: {
        eventId: "event-1",
        externalFormId: "google-form-id",
        formUrl: "https://forms.google.com/example",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      },
      user: fakeUser({ isAdmin: true }),
    });

    expect(connection).toMatchObject({
      createdBy: "user-a",
      eventId: "event-1",
      externalFormId: "google-form-id",
      formUrl: "https://forms.google.com/example",
      provider: "google_forms",
      purpose: "registration",
    });
    expect("fields" in connection).toBe(false);
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        fields: [{ label: "Name" }],
        formUrl: "https://forms.google.com/example",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow();
  });

  it("rejects secrets and unsupported provider or status values", () => {
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        formUrl: "https://forms.google.com/example?token=secret",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow();
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        formUrl: "https://forms.google.com/example",
        metadata: { apiKey: "secret" },
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow();
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        formUrl: "https://forms.google.com/example",
        provider: "typeform",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow();
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        formUrl: "https://forms.google.com/example",
        provider: "google_forms",
        purpose: "registration",
        status: "enabled",
        title: "Registration form",
      }),
    ).toThrow();
  });

  it("keeps placeholder event permissions conservative", async () => {
    const user = fakeUser({ isAdmin: false });
    const service = createFormConnectionService({
      now: fixedNow,
      repository: createFakeFormConnectionRepository(),
    });

    expect(canListFormConnections(user)).toBe(false);
    expect(canManageFormConnections(user, "event-1")).toBe(false);
    await expect(
      service.listFormConnections({
        user,
      }),
    ).rejects.toThrow("access is required");
  });
});

function createFakeFormConnectionRepository(): FormConnectionRepository {
  const connections: FormConnection[] = [];

  return {
    async create(input: CreateFormConnectionInput & {
      createdAt: string;
      createdBy: string;
      updatedAt: string;
    }) {
      const connection: FormConnection = {
        ...input,
        createdAt: input.createdAt,
        createdBy: input.createdBy,
        id: `form-${connections.length + 1}`,
        status: input.status ?? "active",
        updatedAt: input.updatedAt,
      };
      connections.push(connection);
      return connection;
    },
    async list(options = {}) {
      return options.eventId
        ? connections.filter((connection) => connection.eventId === options.eventId)
        : connections;
    },
  };
}

function fakeUser(input: Partial<SessionUser> = {}): SessionUser {
  return {
    authUser: {
      email: "user@example.com",
      id: "user-a",
      name: "User A",
    },
    eventRoles: [],
    isAdmin: false,
    profile: {
      $id: "user-a",
      authUserId: "user-a",
      googleEmail: "user@example.com",
      status: "ACTIVE",
      uomVerified: true,
    },
    sbRoles: [],
    ...input,
  };
}

function fixedNow() {
  return new Date("2026-06-01T10:00:00.000Z");
}
