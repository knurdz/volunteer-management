import { describe, expect, it } from "vitest";
import {
  assertCanReportRecommendation,
  assertCanRequestRecommendation,
  assertCanRespondToRecommendation,
  shouldRecoverAcceptedRequest,
} from "../src/features/recommendations/lib/rules";
import {
  recommendationRequestKey,
  recommendationRequestRowId,
  recommendationRowId,
} from "../src/features/recommendations/lib/ids";

describe("recommendation rules", () => {
  it("blocks self recommendations", () => {
    expect(() =>
      assertCanRequestRecommendation({
        requesterId: "user-1",
        respondentId: "user-1",
      }),
    ).toThrow("cannot recommend themselves");
  });

  it("allows recommendation requests between different users", () => {
    expect(() =>
      assertCanRequestRecommendation({
        requesterId: "user-1",
        respondentId: "user-2",
      }),
    ).not.toThrow();
  });

  it("requires verified volunteers on both sides of a request", () => {
    expect(() =>
      assertCanRequestRecommendation({
        requesterCanVolunteer: false,
        requesterId: "user-1",
        respondentId: "user-2",
      }),
    ).toThrow("Verified UoM email");

    expect(() =>
      assertCanRequestRecommendation({
        requesterId: "user-1",
        respondentCanVolunteer: false,
        respondentId: "user-2",
      }),
    ).toThrow("verified volunteers");
  });

  it("requires a real respondent profile", () => {
    expect(() =>
      assertCanRequestRecommendation({
        requesterId: "user-1",
        respondentExists: false,
        respondentId: "user-2",
      }),
    ).toThrow("not found");
  });

  it("only lets the requested volunteer answer a pending request", () => {
    expect(() =>
      assertCanRespondToRecommendation({
        requestRespondentId: "user-2",
        requestStatus: "PENDING",
        userId: "user-2",
      }),
    ).not.toThrow();

    expect(() =>
      assertCanRespondToRecommendation({
        requestRespondentId: "user-2",
        requestStatus: "PENDING",
        userId: "user-3",
      }),
    ).toThrow("requested volunteer");

    expect(() =>
      assertCanRespondToRecommendation({
        requestRespondentId: "user-2",
        requestStatus: "ACCEPTED",
        userId: "user-2",
      }),
    ).toThrow("already been answered");
  });

  it("only allows visible recommendations to be reported", () => {
    expect(() =>
      assertCanReportRecommendation({
        status: "VISIBLE",
      }),
    ).not.toThrow();

    expect(() =>
      assertCanReportRecommendation({
        status: "HIDDEN",
      }),
    ).toThrow("visible recommendations");
  });

  it("uses deterministic ids to prevent duplicate request and recommendation rows", () => {
    expect(recommendationRequestKey("user-1", "user-2")).toBe(
      recommendationRequestKey("user-1", "user-2"),
    );
    expect(recommendationRequestRowId("user-1", "user-2")).toBe(
      recommendationRequestRowId("user-1", "user-2"),
    );
    expect(recommendationRequestRowId("user-1", "user-2")).not.toBe(
      recommendationRequestRowId("user-2", "user-1"),
    );
    expect(recommendationRowId("request-1")).toBe(recommendationRowId("request-1"));
    expect(recommendationRowId("request-1")).not.toBe(recommendationRowId("request-2"));
  });

  it("recovers a pending request when its recommendation already exists", () => {
    expect(
      shouldRecoverAcceptedRequest({
        existingRecommendation: true,
        requestStatus: "PENDING",
        response: "ACCEPTED",
      }),
    ).toBe(true);
    expect(
      shouldRecoverAcceptedRequest({
        existingRecommendation: false,
        requestStatus: "PENDING",
        response: "ACCEPTED",
      }),
    ).toBe(false);
    expect(
      shouldRecoverAcceptedRequest({
        existingRecommendation: true,
        requestStatus: "PENDING",
        response: "REJECTED",
      }),
    ).toBe(false);
  });
});
