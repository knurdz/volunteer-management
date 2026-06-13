"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dateInputToIso,
  eventInputClasses,
  eventTextareaClasses,
} from "@/features/events/lib/event-ui";
import { CreateEventInputSchema } from "@/features/events/types";
import { IEEE_TERMS } from "@/lib/config";
import { cn } from "@/lib/utils";

type FormState = {
  title: string;
  reference: string;
  description: string;
  term: string;
  year: string;
  start_date: string;
  end_date: string;
};

const initialFormState: FormState = {
  title: "",
  reference: "",
  description: "",
  term: "",
  year: String(new Date().getFullYear()),
  start_date: "",
  end_date: "",
};

export function CreateEventForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});

    const year = Number.parseInt(form.year, 10);
    const payload = {
      title: form.title,
      reference: form.reference,
      description: form.description || undefined,
      term: form.term,
      year: Number.isNaN(year) ? form.year : year,
      start_date: form.start_date ? dateInputToIso(form.start_date) : "",
      end_date: form.end_date ? dateInputToIso(form.end_date) : undefined,
    };

    const parsed = CreateEventInputSchema.safeParse(payload);

    if (!parsed.success) {
      const nextFieldErrors: Record<string, string> = {};

      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        nextFieldErrors[key] = issue.message;
      }

      setFieldErrors(nextFieldErrors);
      setError("Please correct the highlighted fields.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/events", {
        body: JSON.stringify(parsed.data),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const responsePayload = await response.json();

      if (!response.ok) {
        setError(responsePayload.error ?? "Could not create event.");
        return;
      }

      router.push(`/events/${responsePayload.event.$id}`);
      router.refresh();
    } catch {
      setError("Could not create event.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          error={fieldErrors.title}
          id="title"
          label="Title"
          onChange={(value) => updateField("title", value)}
          required
          value={form.title}
        />
        <Field
          error={fieldErrors.reference}
          id="reference"
          label="Reference code"
          onChange={(value) => updateField("reference", value)}
          placeholder="foresight-4.0"
          required
          value={form.reference}
        />
      </div>

      <label className="block text-sm font-medium text-text-secondary" htmlFor="description">
        Description
        <textarea
          className={cn(eventTextareaClasses, "mt-1")}
          id="description"
          onChange={(event) => updateField("description", event.target.value)}
          value={form.description}
        />
        {fieldErrors.description ? (
          <span className="mt-1 block text-xs text-danger">{fieldErrors.description}</span>
        ) : null}
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-text-secondary" htmlFor="term">
          IEEE Term
          <select
            className={cn(eventInputClasses, "mt-1")}
            id="term"
            onChange={(event) => updateField("term", event.target.value)}
            required
            value={form.term}
          >
            <option value="">Select term</option>
            {IEEE_TERMS.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
          {fieldErrors.term ? (
            <span className="mt-1 block text-xs text-danger">{fieldErrors.term}</span>
          ) : null}
        </label>
        <Field
          error={fieldErrors.year}
          id="year"
          inputMode="numeric"
          label="Year"
          onChange={(value) => updateField("year", value)}
          required
          type="number"
          value={form.year}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          error={fieldErrors.start_date}
          id="start_date"
          label="Start date"
          onChange={(value) => updateField("start_date", value)}
          required
          type="date"
          value={form.start_date}
        />
        <Field
          error={fieldErrors.end_date}
          id="end_date"
          label="End date (optional)"
          onChange={(value) => updateField("end_date", value)}
          type="date"
          value={form.end_date}
        />
      </div>

      {error ? (
        <p className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button disabled={submitting} type="submit" variant="primary">
        <Save className="size-4" aria-hidden="true" />
        {submitting ? "Creating..." : "Create Event"}
      </Button>
    </form>
  );
}

function Field({
  error,
  id,
  inputMode,
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  error?: string;
  id: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-text-secondary" htmlFor={id}>
      {label}
      <input
        className={cn(eventInputClasses, "mt-1")}
        id={id}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  );
}
