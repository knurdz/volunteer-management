"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type RequestResult = {
  deliveredTo: string;
  expiresAt: string;
  requestId: string;
};

export function VerificationPanel() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [requestResult, setRequestResult] = useState<RequestResult | null>(null);
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [submitting, setSubmitting] = useState<"confirm" | "request" | null>(null);
  const [uomEmail, setUomEmail] = useState("");

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting("request");
    setStatus("idle");
    setMessage("Sending verification email...");

    try {
      const response = await fetch("/api/uom-verification/request", {
        body: JSON.stringify({ uomEmail }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Could not send the verification email.");
        return;
      }

      setRequestResult(payload);
      setStatus("success");
      setMessage(`Verification code sent to ${payload.deliveredTo}. Check your UoM webmail.`);
    } finally {
      setSubmitting(null);
    }
  }

  async function confirmCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!requestResult) {
      setStatus("error");
      setMessage("Request a code first.");
      return;
    }

    setSubmitting("confirm");
    setStatus("idle");
    setMessage("Confirming code...");
    try {
      const response = await fetch("/api/uom-verification/confirm", {
        body: JSON.stringify({ code, requestId: requestResult.requestId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Could not confirm code.");
        return;
      }

      setStatus("success");
      setMessage("UoM email verified.");
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-surface-subtle text-primary">
            <Mail className="size-5" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">Request code</h3>
          <p className="text-sm leading-6 text-text-secondary">
            Enter the university email address connected to your volunteer identity.
          </p>
        </div>
        <form className="space-y-3" onSubmit={requestCode}>
          <label className="block text-sm font-medium text-text-secondary" htmlFor="uom-email">
            UoM email
          </label>
          <input
            className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary"
            id="uom-email"
            onChange={(event) => setUomEmail(event.target.value)}
            placeholder="name@uom.lk"
            required
            type="email"
            value={uomEmail}
          />
          <Button disabled={submitting === "request"} type="submit" variant="primary">
            <Send className="size-4" aria-hidden="true" />
            {submitting === "request" ? "Sending" : "Send Code"}
          </Button>
        </form>
      </section>

      {requestResult ? (
        <div className="rounded-md border border-success/25 bg-success-soft p-4 text-sm text-success">
          <p className="font-semibold">Verification email sent</p>
          <p className="mt-1">
            Sent to {requestResult.deliveredTo}. The code expires at{" "}
            {new Date(requestResult.expiresAt).toLocaleString()}.
          </p>
        </div>
      ) : null}

      <section className="grid gap-5 border-t border-border pt-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-surface-subtle text-primary">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">Confirm code</h3>
          <p className="text-sm leading-6 text-text-secondary">
            Enter the code from webmail to complete verification.
          </p>
        </div>
        <form className="space-y-3" onSubmit={confirmCode}>
          <label className="block text-sm font-medium text-text-secondary" htmlFor="code">
            Verification code
          </label>
          <input
            className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary"
            id="code"
            inputMode="numeric"
            onChange={(event) => setCode(event.target.value)}
            placeholder="6-digit code"
            required
            value={code}
          />
          <Button disabled={submitting === "confirm" || !requestResult} type="submit">
            <KeyRound className="size-4" aria-hidden="true" />
            {submitting === "confirm" ? "Confirming" : "Confirm Code"}
          </Button>
        </form>
      </section>

      {message ? (
        <p
          className={
            status === "error"
              ? "rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
              : "text-sm text-text-secondary"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
