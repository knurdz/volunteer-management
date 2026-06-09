"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RecommendationRequestForm({
  respondentId,
  respondentName,
}: {
  respondentId: string;
  respondentName: string;
}) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function requestRecommendation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");

    try {
      const response = await fetch("/api/recommendations/request", {
        body: JSON.stringify({ message, respondentId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Recommendation request failed.");
      }

      setMessage("");
      setStatus(`Request sent to ${respondentName}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recommendation request failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={requestRecommendation}>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-text-secondary">
          Request a recommendation
        </span>
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary"
          maxLength={500}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Optional context for what you want them to write about."
          value={message}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={saving} type="submit">
          <Send className="size-4" aria-hidden="true" />
          {saving ? "Sending" : "Send Request"}
        </Button>
        {status ? <p className="text-sm text-text-secondary">{status}</p> : null}
      </div>
    </form>
  );
}
