import { describe, expect, it } from "vitest";
import {
  assertCanReportRecommendation,
  assertCanRequestRecommendation,
  assertCanRespondToRecommendation,
  shouldBlockDuplicateRecommendationRequest,
  shouldRepairAcceptedRequest,
  shouldRecoverAcceptedRequest,
  statusAfterReport,
} from "../src/features/recommendations/lib/rules";
import {
  recommendationRequestKey,
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

  it("uses request keys for pending duplicate checks and deterministic recommendation ids", () => {
    expect(recommendationRequestKey("user-1", "user-2")).toBe(
      recommendationRequestKey("user-1", "user-2"),
    );
    expect(recommendationRequestKey("user-1", "user-2")).not.toBe(
      recommendationRequestKey("user-2", "user-1"),
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

  it("repairs an accepted request when its recommendation is missing", () => {
    expect(
      shouldRepairAcceptedRequest({
        existingRecommendation: false,
        requestStatus: "ACCEPTED",
        response: "ACCEPTED",
      }),
    ).toBe(true);
    expect(
      shouldRepairAcceptedRequest({
        existingRecommendation: true,
        requestStatus: "ACCEPTED",
        response: "ACCEPTED",
      }),
    ).toBe(false);
  });

  it("keeps reported recommendations visible until admin hides them", () => {
    expect(statusAfterReport("VISIBLE")).toBe("VISIBLE");
    expect(() => statusAfterReport("HIDDEN")).toThrow("visible recommendations");
  });

  it("blocks duplicate requests only while one is still pending", () => {
    expect(
      shouldBlockDuplicateRecommendationRequest([{ status: "PENDING" }]),
    ).toBe(true);
    expect(
      shouldBlockDuplicateRecommendationRequest([{ status: "REJECTED" }]),
    ).toBe(false);
    expect(
      shouldBlockDuplicateRecommendationRequest([{ status: "ACCEPTED" }]),
    ).toBe(false);
    expect(shouldBlockDuplicateRecommendationRequest([])).toBe(false);
  });

  it("allows a new request after a previous one was rejected", () => {
    const priorRequests = [{ status: "REJECTED" }];

    expect(shouldBlockDuplicateRecommendationRequest(priorRequests)).toBe(false);
  });
});
