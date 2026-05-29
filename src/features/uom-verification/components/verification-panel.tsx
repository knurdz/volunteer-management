"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type RequestResult = {
  deliveredTo: string;
  expiresAt: string;
  requestId: string;
};

export function VerificationPanel() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [requestResult, setRequestResult] = useState<RequestResult | null>(null);
  const [uomEmail, setUomEmail] = useState("");

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Requesting code...");

    const response = await fetch("/api/uom-verification/request", {
      body: JSON.stringify({ uomEmail }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Could not request code.");
      return;
    }

    setRequestResult(payload);
    setMessage(`Verification code sent to ${payload.deliveredTo}. Check your UoM webmail.`);
  }

  async function confirmCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!requestResult) {
      setMessage("Request a code first.");
      return;
    }

    setMessage("Confirming code...");
    const response = await fetch("/api/uom-verification/confirm", {
      body: JSON.stringify({ code, requestId: requestResult.requestId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Could not confirm code.");
      return;
    }

    setMessage("UoM email verified. Go back to the dashboard.");
  }

  return (
    <div className="space-y-5">
      <form className="space-y-3" onSubmit={requestCode}>
        <label className="block text-sm font-medium text-text-secondary" htmlFor="uom-email">
          UoM email
        </label>
        <input
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
          id="uom-email"
          onChange={(event) => setUomEmail(event.target.value)}
          placeholder="name@uom.lk"
          type="email"
          value={uomEmail}
        />
        <Button type="submit" variant="primary">
          Request code
        </Button>
      </form>

      {requestResult ? (
        <div className="rounded-md border border-border bg-surface-subtle p-3 text-sm text-text-secondary">
          <p>Sent to: {requestResult.deliveredTo}</p>
          <p>Expires: {new Date(requestResult.expiresAt).toLocaleString()}</p>
        </div>
      ) : null}

      <form className="space-y-3" onSubmit={confirmCode}>
        <label className="block text-sm font-medium text-text-secondary" htmlFor="code">
          Verification code
        </label>
        <input
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
          id="code"
          onChange={(event) => setCode(event.target.value)}
          placeholder="6-digit code"
          value={code}
        />
        <Button type="submit">Confirm code</Button>
      </form>

      {message ? <p className="text-sm text-text-secondary">{message}</p> : null}
    </div>
  );
}
