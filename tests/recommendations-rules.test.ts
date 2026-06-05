import { describe, expect, it } from "vitest";
import {
  assertCanReportRecommendation,
  assertCanRequestRecommendation,
  assertCanRespondToRecommendation,
} from "../src/features/recommendations/lib/rules";

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
});
