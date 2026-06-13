import { describe, expect, it } from "vitest";
import {
  assertMergedEventDateRange,
  assertCommitteeExistsForRole,
  resolveCommitteeByName,
} from "@/features/events/lib/event-validation";
import { ValidationError } from "@/server/errors";
import type { Committee, Event } from "@/features/events/types";

function createEventFixture(overrides: Partial<Event> = {}): Event {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $id: "event-1",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    conclusion_status: "not_submitted",
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "admin-user",
    reference: "MF-4",
    start_date: "2026-06-01T00:00:00.000Z",
    status: "draft",
    term: "2025/2026",
    title: "MoraForesight 4.0",
    updated_at: "2026-01-01T00:00:00.000Z",
    year: 2026,
    ...overrides,
  };
}

const committees: Committee[] = [
  {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $id: "committee-1",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    event_id: "event-1",
    name: "General",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("event-validation", () => {
  it("validates partial end_date updates against stored start_date", () => {
    const existing = createEventFixture({ start_date: "2026-06-01T00:00:00.000Z" });

    expect(() =>
      assertMergedEventDateRange(existing, { end_date: "2026-05-01T00:00:00.000Z" }),
    ).toThrow(ValidationError);
  });

  it("accepts partial end_date updates after stored start_date", () => {
    const existing = createEventFixture({ start_date: "2026-06-01T00:00:00.000Z" });

    expect(() =>
      assertMergedEventDateRange(existing, { end_date: "2026-07-01T00:00:00.000Z" }),
    ).not.toThrow();
  });

  it("resolves committee names case-insensitively", () => {
    expect(resolveCommitteeByName(committees, "general")?.$id).toBe("committee-1");
  });

  it("rejects committee lead assignment when committee name is unknown", () => {
    expect(() =>
      assertCommitteeExistsForRole({
        committeeName: "Unknown",
        committees,
        role: "Committee Lead",
      }),
    ).toThrow(ValidationError);
  });
});
