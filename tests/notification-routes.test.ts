import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("notification routes", () => {
  it("loads and saves current-user notification preferences", async () => {
    const getPreference = vi.fn(async () => ({
      createdAt: "2026-06-01T10:00:00.000Z",
      emailEnabled: false,
      inAppEnabled: true,
      typePreferences: {},
      updatedAt: "2026-06-01T10:00:00.000Z",
      userId: "user-a",
    }));
    const upsertPreference = vi.fn(async () => ({
      createdAt: "2026-06-01T10:00:00.000Z",
      emailEnabled: true,
      inAppEnabled: true,
      typePreferences: {},
      updatedAt: "2026-06-01T10:01:00.000Z",
      userId: "user-a",
    }));

    vi.doMock("@/features/notifications/server/notification-service", () => ({
      getNotificationPreferencesForCurrentUser: getPreference,
      upsertNotificationPreferencesForCurrentUser: upsertPreference,
    }));

    const route = await import("../src/app/api/notifications/preferences/route");
    const getResponse = await route.GET();
    const putResponse = await route.PUT(
      jsonRequest("https://app.test/api/notifications/preferences", {
        emailEnabled: true,
        inAppEnabled: true,
        typePreferences: {},
      }),
    );

    await expect(getResponse.json()).resolves.toMatchObject({
      preference: {
        userId: "user-a",
      },
    });
    await expect(putResponse.json()).resolves.toMatchObject({
      preference: {
        emailEnabled: true,
        userId: "user-a",
      },
    });
    expect(upsertPreference).toHaveBeenCalledWith({
      emailEnabled: true,
      inAppEnabled: true,
      typePreferences: {},
    });
  });

  it("rejects malformed preference route inputs", async () => {
    vi.doMock("@/features/notifications/server/notification-service", () => ({
      getNotificationPreferencesForCurrentUser: vi.fn(),
      upsertNotificationPreferencesForCurrentUser: vi.fn(),
    }));

    const route = await import("../src/app/api/notifications/preferences/route");
    const response = await route.PUT(
      jsonRequest("https://app.test/api/notifications/preferences", {
        emailEnabled: true,
        inAppEnabled: true,
        typePreferences: {
          system: {
            emailEnabled: "yes",
          },
        },
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects unsafe trusted notification creation links", async () => {
    const createNotification = vi.fn();

    vi.doMock("@/lib/env", () => ({
      getServerEnv: () => ({
        INTERNAL_JOB_TOKEN: "server-secret",
      }),
    }));
    vi.doMock("@/features/notifications/server/notification-service", () => ({
      createNotification,
      listNotificationsForCurrentUser: vi.fn(),
    }));

    const route = await import("../src/app/api/notifications/route");
    const response = await route.POST(
      jsonRequest(
        "https://app.test/api/notifications",
        {
          linkHref: "https://evil.example/phish",
          message: "Open this",
          recipientUserId: "user-a",
          title: "Unsafe",
          type: "system",
        },
        {
          "x-internal-job-token": "server-secret",
        },
      ),
    );

    expect(response.status).toBe(400);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("creates a role workflow notification after role assignment", async () => {
    const notifyRoleAssignmentWorkflow = vi.fn(async () => ({
      notification: {
        id: "n-1",
      },
    }));

    vi.doMock("@/features/access-control/server/current-user", () => ({
      requireAdmin: vi.fn(async () => ({
        authUser: {
          id: "admin-a",
        },
      })),
    }));
    vi.doMock("@/features/access-control/server/roles", () => ({
      assignSbRole: vi.fn(async () => ({
        $id: "role-1",
        active: true,
        assignedAt: "2026-06-01T10:00:00.000Z",
        assignedBy: "admin-a",
        role: "SB Member",
        userId: "user-a",
      })),
      parseSbRole: vi.fn((role: string) => role),
    }));
    vi.doMock("@/features/notifications/server/workflow-notifications", () => ({
      notifyRoleAssignmentWorkflow,
    }));

    const route = await import("../src/app/api/admin/roles/assign/route");
    const response = await route.POST(
      jsonRequest("https://app.test/api/admin/roles/assign", {
        role: "SB Member",
        userId: "user-a",
      }),
    );

    expect(response.status).toBe(200);
    expect(notifyRoleAssignmentWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-a",
        assignment: expect.objectContaining({
          userId: "user-a",
        }),
      }),
    );
  });

  it("creates a verification workflow notification after UoM confirmation", async () => {
    const notifyVerificationWorkflow = vi.fn(async () => ({
      notification: {
        id: "n-verification",
      },
    }));

    vi.doMock("@/features/access-control/server/current-user", () => ({
      requireAuth: vi.fn(async () => ({
        authUser: {
          id: "user-a",
        },
      })),
    }));
    vi.doMock("@/features/access-control/server/uom-verification", () => ({
      confirmUomVerification: vi.fn(async () => ({
        authUserId: "user-a",
        uomVerified: true,
      })),
    }));
    vi.doMock("@/features/notifications/server/workflow-notifications", () => ({
      notifyVerificationWorkflow,
    }));

    const route = await import("../src/app/api/uom-verification/confirm/route");
    const response = await route.POST(
      jsonRequest("https://app.test/api/uom-verification/confirm", {
        code: "123456",
        requestId: "request-a",
      }),
    );

    expect(response.status).toBe(200);
    expect(notifyVerificationWorkflow).toHaveBeenCalledWith({
      actorUserId: "user-a",
      recipientUserId: "user-a",
      verified: true,
    });
  });

  it("creates form workflow notifications for active verified event recipients", async () => {
    const notifyEventUpdateWorkflow = vi.fn(async () => []);
    const notifyGradingRequestWorkflow = vi.fn(async () => []);

    vi.doMock("@/features/access-control/server/current-user", () => ({
      requireAuth: vi.fn(async () => ({
        authUser: {
          id: "chair-a",
        },
      })),
    }));
    vi.doMock("@/features/forms/server/form-connection-service", () => ({
      createFormConnectionForCurrentUser: vi.fn(async (input: Record<string, unknown>) => ({
        ...input,
        id: "form-a",
      })),
      listFormConnectionsForCurrentUser: vi.fn(),
    }));
    vi.doMock("@/features/access-control/server/profiles", () => ({
      listProfiles: vi.fn(async () => [
        {
          authUserId: "user-a",
          status: "ACTIVE",
          uomVerified: true,
        },
        {
          authUserId: "user-b",
          status: "ACTIVE",
          uomVerified: false,
        },
      ]),
    }));
    vi.doMock("@/features/access-control/server/roles", () => ({
      listActiveEventRoleAssignments: vi.fn(async () => [
        {
          eventId: "event-1",
          eventTitle: "MoraForesight",
          userId: "user-a",
        },
        {
          eventId: "event-1",
          eventTitle: "MoraForesight",
          userId: "user-b",
        },
      ]),
    }));
    vi.doMock("@/features/notifications/server/workflow-notifications", () => ({
      notifyEventUpdateWorkflow,
      notifyGradingRequestWorkflow,
    }));

    const route = await import("../src/app/api/forms/connections/route");
    const response = await route.POST(
      jsonRequest("https://app.test/api/forms/connections", {
        eventId: "event-1",
        externalFormId: "grading-form",
        provider: "google_forms",
        purpose: "grading",
        title: "Grading form",
      }),
    );

    expect(response.status).toBe(201);
    expect(notifyGradingRequestWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-1",
        eventTitle: "MoraForesight",
        recipientUserIds: ["user-a"],
      }),
    );
    expect(notifyEventUpdateWorkflow).not.toHaveBeenCalled();
  });
});

function jsonRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    method: "POST",
  });
}
