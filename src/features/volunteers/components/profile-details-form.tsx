"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import type { VolunteerProfileDetails } from "@/features/volunteers/types";

export function ProfileDetailsForm({
  initialDetails,
}: {
  initialDetails: VolunteerProfileDetails | null;
}) {
  const [batchYear, setBatchYear] = useState(initialDetails?.batchYear ?? "");
  const [bio, setBio] = useState(initialDetails?.bio ?? "");
  const [department, setDepartment] = useState(initialDetails?.department ?? "");
  const [faculty, setFaculty] = useState(initialDetails?.faculty ?? "");
  const [headline, setHeadline] = useState(initialDetails?.headline ?? "");
  const [ieeeMembership, setIeeeMembership] = useState(
    initialDetails?.ieeeMembership ?? "",
  );
  const [linkedinUrl, setLinkedinUrl] = useState(initialDetails?.linkedinUrl ?? "");
  const [skills, setSkills] = useState(initialDetails?.skills ?? "");
  const [status, setStatus] = useState("");
  const [universityIndex, setUniversityIndex] = useState(
    initialDetails?.universityIndex ?? "",
  );
  const [saving, setSaving] = useState(false);

  async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");

    try {
      const response = await fetch("/api/volunteers/me", {
        body: JSON.stringify({
          batchYear,
          bio,
          department,
          faculty,
          headline,
          ieeeMembership,
          linkedinUrl,
          skills,
          universityIndex,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Profile update failed.");
      }

      setStatus("Saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={saveDetails}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="University Index">
          <input
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            maxLength={40}
            onChange={(event) => setUniversityIndex(event.target.value)}
            required
            value={universityIndex}
          />
        </Field>
        <Field label="Batch / Year">
          <input
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            maxLength={40}
            onChange={(event) => setBatchYear(event.target.value)}
            required
            value={batchYear}
          />
        </Field>
        <Field label="Faculty">
          <input
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            maxLength={120}
            onChange={(event) => setFaculty(event.target.value)}
            required
            value={faculty}
          />
        </Field>
        <Field label="Department">
          <input
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            maxLength={120}
            onChange={(event) => setDepartment(event.target.value)}
            required
            value={department}
          />
        </Field>
      </div>
      <Field label="IEEE Membership">
        <input
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
          maxLength={120}
          onChange={(event) => setIeeeMembership(event.target.value)}
          placeholder="Member status or membership number"
          required
          value={ieeeMembership}
        />
      </Field>
      <Field label="Headline">
        <input
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
          maxLength={160}
          onChange={(event) => setHeadline(event.target.value)}
          value={headline}
        />
      </Field>
      <Field label="LinkedIn URL">
        <input
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
          maxLength={240}
          onChange={(event) => setLinkedinUrl(event.target.value)}
          placeholder="https://www.linkedin.com/in/..."
          value={linkedinUrl}
        />
      </Field>
      <Field label="Skills">
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-primary"
          maxLength={500}
          onChange={(event) => setSkills(event.target.value)}
          value={skills}
        />
      </Field>
      <Field label="Bio">
        <textarea
          className="min-h-36 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-primary"
          maxLength={1200}
          onChange={(event) => setBio(event.target.value)}
          value={bio}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button className={buttonClasses()} disabled={saving} type="submit">
          <Save className="size-4" aria-hidden="true" />
          {saving ? "Saving" : "Save Profile"}
        </button>
        {status ? <p className="text-sm text-text-secondary">{status}</p> : null}
      </div>
    </form>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
