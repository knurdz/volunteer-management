"use client";

import { useState } from "react";
import { CheckCircle2, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecommendationWithProfiles } from "@/features/recommendations/types";

export function ReportedRecommendationsPanel({
  initialRecommendations,
}: {
  initialRecommendations: RecommendationWithProfiles[];
}) {
  const [hideReasons, setHideReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState(initialRecommendations);

  async function hideRecommendation(recommendationId: string) {
    setPendingId(recommendationId);
    setMessage("");

    try {
      const response = await fetch("/api/recommendations/hide", {
        body: JSON.stringify({
          reason: hideReasons[recommendationId] ?? "",
          recommendationId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Recommendation hide failed.");
      }

      setRecommendations((current) =>
        current.filter((recommendation) => recommendation.$id !== recommendationId),
      );
      setMessage("Recommendation hidden.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommendation hide failed.");
    } finally {
      setPendingId(null);
    }
  }

  async function dismissReport(recommendationId: string) {
    setPendingId(recommendationId);
    setMessage("");

    try {
      const response = await fetch("/api/recommendations/dismiss-report", {
        body: JSON.stringify({ recommendationId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Report dismiss failed.");
      }

      setRecommendations((current) =>
        current.filter((recommendation) => recommendation.$id !== recommendationId),
      );
      setMessage("Report dismissed. Recommendation remains visible.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report dismiss failed.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {recommendations.length > 0 ? (
        recommendations.map((recommendation) => (
          <article className="rounded-md border border-border p-4" key={recommendation.$id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Reported recommendation
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  For {displayName(recommendation.requester)} from{" "}
                  {displayName(recommendation.respondent)}
                </p>
              </div>
              <Badge tone="warning">REPORTED</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-text-primary">{recommendation.text}</p>
            <div className="mt-3 grid gap-2 text-sm text-text-secondary md:grid-cols-2">
              <Info label="Report reason" value={recommendation.reportReason ?? "No reason provided"} />
              <Info label="Reported by" value={recommendation.reportedBy ?? "Unknown"} />
            </div>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium text-text-secondary">Hide reason</span>
              <textarea
                className="min-h-20 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary"
                maxLength={500}
                onChange={(event) =>
                  setHideReasons((current) => ({
                    ...current,
                    [recommendation.$id]: event.target.value,
                  }))
                }
                placeholder="Explain why this content is being hidden."
                value={hideReasons[recommendation.$id] ?? ""}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={pendingId === recommendation.$id}
                onClick={() => dismissReport(recommendation.$id)}
                type="button"
                variant="secondary"
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Dismiss Report
              </Button>
              <Button
                disabled={pendingId === recommendation.$id}
                onClick={() => hideRecommendation(recommendation.$id)}
                type="button"
              >
                <EyeOff className="size-4" aria-hidden="true" />
                Hide Content
              </Button>
            </div>
          </article>
        ))
      ) : (
        <p className="text-sm text-text-secondary">No reported recommendations need review.</p>
      )}
      {message ? <p className="text-sm text-text-secondary">{message}</p> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-text-primary">{label}</p>
      <p className="break-words">{value}</p>
    </div>
  );
}

function displayName(profile: RecommendationWithProfiles["requester"]) {
  if (!profile) {
    return "Unknown volunteer";
  }

  return profile.name || profile.uomEmail || profile.googleEmail || profile.userId;
}
