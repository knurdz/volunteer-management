"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecommendationWithRespondent } from "@/features/recommendations/types";

export function RecommendationList({
  canReport,
  initialRecommendations,
}: {
  canReport: boolean;
  initialRecommendations: RecommendationWithRespondent[];
}) {
  const [message, setMessage] = useState("");
  const [pendingReport, setPendingReport] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState(initialRecommendations);

  async function reportRecommendation(recommendationId: string) {
    const reason = window.prompt("Why should this recommendation be reviewed?");

    if (reason === null) {
      return;
    }

    setPendingReport(recommendationId);
    setMessage("");

    try {
      const response = await fetch("/api/recommendations/report", {
        body: JSON.stringify({ reason, recommendationId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Recommendation report failed.");
      }

      setRecommendations((current) =>
        current.filter((recommendation) => recommendation.$id !== recommendationId),
      );
      setMessage("Recommendation reported for admin review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommendation report failed.");
    } finally {
      setPendingReport(null);
    }
  }

  return (
    <div className="space-y-3">
      {recommendations.length > 0 ? (
        recommendations.map((recommendation) => (
          <div className="rounded-md border border-border p-4" key={recommendation.$id}>
            <p className="text-sm leading-6 text-text-primary">{recommendation.text}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-text-muted">
                From {displayRespondent(recommendation)}
              </p>
              {canReport ? (
                <Button
                  disabled={pendingReport === recommendation.$id}
                  onClick={() => reportRecommendation(recommendation.$id)}
                  type="button"
                  variant="ghost"
                >
                  <Flag className="size-4" aria-hidden="true" />
                  Report
                </Button>
              ) : null}
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-text-secondary">No visible recommendations yet.</p>
      )}
      {message ? <p className="text-sm text-text-secondary">{message}</p> : null}
    </div>
  );
}

function displayRespondent(recommendation: RecommendationWithRespondent) {
  const respondent = recommendation.respondent;

  if (!respondent) {
    return `user ${recommendation.respondentId}`;
  }

  return respondent.name || respondent.uomEmail || respondent.googleEmail;
}
