import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  REQUIRED_NOTIFICATION_WORKFLOWS,
  notifyEventUpdateWorkflow,
  notifyGradingRequestWorkflow,
  notifyReportApprovalWorkflow,
  notifyRoleAssignmentWorkflow,
  notifyVerificationWorkflow,
} from "../src/features/notifications/server/workflow-notifications";

describe("notification workflow triggers", () => {
  it("covers all required workflow notification types", () => {
    expect(REQUIRED_NOTIFICATION_WORKFLOWS).toEqual([
      "verification",
      "role_assignment",
      "event_update",
      "grading_request",
      "report_approval",
    ]);
  });

  it("creates verification and role assignment notifications", async () => {
    const service = createWorkflowService();

    await notifyVerificationWorkflow({
      recipientUserId: "user-a",
      service,
    });
    await notifyRoleAssignmentWorkflow({
      actorUserId: "admin-a",
      assignment: {
        role: "SB Member",
        userId: "user-a",
      },
      service,
    });

    expect(service.createVerificationNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "user-a",
        verified: true,
      }),
    );
    expect(service.createRoleAssignmentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "user-a",
        role: "SB Member",
        scope: "IEEE SB UoM",
      }),
    );
  });

  it("deduplicates event update recipients and records failures", async () => {
    const service = createWorkflowService({
      createEventUpdateNotification: vi.fn(async (input) => {
        if (input.recipientUserId === "user-b") {
          throw new Error("Write failed");
        }

        return fakeNotificationResult(input.recipientUserId);
      }),
    });

    const results = await notifyEventUpdateWorkflow({
      eventId: "event-1",
      eventTitle: "MoraForesight",
      recipientUserIds: ["user-a", "user-a", "user-b"],
      service,
    });

    expect(service.createEventUpdateNotification).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      expect.objectContaining({
        recipientUserId: "user-a",
        status: "created",
      }),
      expect.objectContaining({
        error: "Write failed",
        recipientUserId: "user-b",
        status: "failed",
      }),
    ]);
  });

  it("creates grading request and report approval workflow notifications", async () => {
    const service = createWorkflowService();

    await notifyGradingRequestWorkflow({
      eventId: "event-1",
      eventTitle: "MoraForesight",
      recipientUserIds: ["user-a"],
      service,
    });
    await notifyReportApprovalWorkflow({
      eventId: "event-1",
      eventTitle: "MoraForesight",
      recipientUserIds: ["user-a"],
      service,
      status: "needs_changes",
    });

    expect(service.createGradingRequestNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-1",
        recipientUserId: "user-a",
      }),
    );
    expect(service.createReportApprovalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "user-a",
        status: "needs_changes",
      }),
    );
  });
});

type WorkflowTestInput = { recipientUserId: string };

function createWorkflowService(overrides: Record<string, unknown> = {}) {
  return {
    createEventUpdateNotification: vi.fn(async (input: WorkflowTestInput) =>
      fakeNotificationResult(input.recipientUserId),
    ),
    createGradingRequestNotification: vi.fn(async (input: WorkflowTestInput) =>
      fakeNotificationResult(input.recipientUserId),
    ),
    createReportApprovalNotification: vi.fn(async (input: WorkflowTestInput) =>
      fakeNotificationResult(input.recipientUserId),
    ),
    createRoleAssignmentNotification: vi.fn(async (input: WorkflowTestInput) =>
      fakeNotificationResult(input.recipientUserId),
    ),
    createVerificationNotification: vi.fn(async (input: WorkflowTestInput) =>
      fakeNotificationResult(input.recipientUserId),
    ),
    ...overrides,
  };
}

function fakeNotificationResult(recipientUserId: string) {
  return {
    notification: {
      createdAt: "2026-06-01T10:00:00.000Z",
      id: `n-${recipientUserId}`,
      message: "Message",
      readAt: null,
      recipientUserId,
      title: "Title",
      type: "system" as const,
    },
  };
}
