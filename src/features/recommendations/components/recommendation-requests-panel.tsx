"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  RecommendationRequestStatus,
  RecommendationRequestWithProfiles,
} from "@/features/recommendations/types";

type RequestsState = {
  incoming: RecommendationRequestWithProfiles[];
  outgoing: RecommendationRequestWithProfiles[];
};

const statusTone: Record<RecommendationRequestStatus, "neutral" | "success" | "warning"> = {
  ACCEPTED: "success",
  PENDING: "warning",
  REJECTED: "neutral",
};

export function RecommendationRequestsPanel({
  initialRequests,
}: {
  initialRequests: RequestsState;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [requests, setRequests] = useState(initialRequests);

  async function respondToRequest({
    requestId,
    response,
  }: {
    requestId: string;
    response: "ACCEPTED" | "REJECTED";
  }) {
    setPendingAction(`${requestId}:${response}`);
    setMessage("");

    try {
      const apiResponse = await fetch("/api/recommendations/respond", {
        body: JSON.stringify({
          requestId,
          response,
          text: drafts[requestId] ?? "",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(result.error ?? "Recommendation response failed.");
      }

      setRequests((current) => ({
        ...current,
        incoming: current.incoming.map((request) =>
          request.$id === requestId
            ? {
                ...request,
                respondedAt: result.request.respondedAt,
                status: result.request.status,
              }
            : request,
        ),
      }));
      setDrafts((current) => ({ ...current, [requestId]: "" }));
      setMessage(response === "ACCEPTED" ? "Recommendation submitted." : "Request rejected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommendation response failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Incoming Requests</h3>
        {requests.incoming.length > 0 ? (
          requests.incoming.map((request) => (
            <div className="rounded-md border border-border p-4" key={request.$id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {displayName(request.requester)}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {request.message || "No message provided."}
                  </p>
                </div>
                <Badge tone={statusTone[request.status]}>{request.status}</Badge>
              </div>
              {request.status === "PENDING" ? (
                <div className="mt-4 space-y-3">
                  <textarea
                    className="min-h-24 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary"
                    maxLength={2000}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [request.$id]: event.target.value,
                      }))
                    }
                    placeholder="Write the recommendation before accepting."
                    value={drafts[request.$id] ?? ""}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={pendingAction === `${request.$id}:ACCEPTED`}
                      onClick={() =>
                        respondToRequest({
                          requestId: request.$id,
                          response: "ACCEPTED",
                        })
                      }
                      type="button"
                    >
                      <Check className="size-4" aria-hidden="true" />
                      Accept and Write
                    </Button>
                    <Button
                      disabled={pendingAction === `${request.$id}:REJECTED`}
                      onClick={() =>
                        respondToRequest({
                          requestId: request.$id,
                          response: "REJECTED",
                        })
                      }
                      type="button"
                      variant="ghost"
                    >
                      <X className="size-4" aria-hidden="true" />
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-text-secondary">No incoming recommendation requests.</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Outgoing Requests</h3>
        {requests.outgoing.length > 0 ? (
          <div className="grid gap-2">
            {requests.outgoing.map((request) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
                key={request.$id}
              >
                <span className="text-text-primary">{displayName(request.respondent)}</span>
                <Badge tone={statusTone[request.status]}>{request.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No outgoing recommendation requests.</p>
        )}
      </section>

      {message ? <p className="text-sm text-text-secondary">{message}</p> : null}
    </div>
  );
}

function displayName(
  profile: RecommendationRequestWithProfiles["requester"],
) {
  if (!profile) {
    return "Unknown volunteer";
  }

  return profile.name || profile.uomEmail || profile.googleEmail;
}
