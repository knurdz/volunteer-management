import { describe, expect, it } from "vitest";
import {
  assertOperationalStatusTransition,
  getOperationalStatusTransitions,
} from "@/features/events/lib/event-status-transitions";
import { ConclusionManagedStatusError } from "@/features/events/lib/event-status-transitions";

describe("operational status transitions", () => {
  it("blocks pending_conclusion via generic status changes", () => {
    expect(() => assertOperationalStatusTransition("ongoing", "pending_conclusion")).toThrow(
      ConclusionManagedStatusError,
    );
  });

  it("blocks closed via generic status changes", () => {
    expect(() => assertOperationalStatusTransition("pending_conclusion", "closed")).toThrow(
      ConclusionManagedStatusError,
    );
  });

  it("excludes conclusion-managed statuses from available transitions", () => {
    const transitions = getOperationalStatusTransitions("ongoing", { isAdmin: true });

    expect(transitions).not.toContain("pending_conclusion");
    expect(transitions).not.toContain("closed");
  });
});
