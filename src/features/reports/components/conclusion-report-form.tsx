"use client";

import { useState } from "react";
import { ClipboardList, Save, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canEditReportContent,
  canExportConclusionReport,
  canSubmitReport,
  reportStatusTone,
} from "@/features/reports/lib/approval-rules";
import {
  createConclusionReportRequest,
  updateConclusionReportRequest,
} from "@/features/reports/lib/api-client";
import type { ConclusionReport, MockEvent } from "@/features/reports/types";
import { ExportActions } from "@/features/reports/components/export-actions";

const inputClasses =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary";

const textareaClasses = `${inputClasses} min-h-[96px] resize-y`;

type ConclusionReportFormProps = {
  events: MockEvent[];
  initialReport?: ConclusionReport | null;
  onChange: (report: ConclusionReport) => void;
};

export function ConclusionReportForm({
  events,
  initialReport,
  onChange,
}: ConclusionReportFormProps) {
  const [eventId, setEventId] = useState(initialReport?.eventId ?? events[0]?.eventId ?? "");
  const [content, setContent] = useState(
    initialReport?.content ?? {
      attendanceNotes: "",
      challenges: "",
      objectives: "",
      outcomes: "",
      recommendations: "",
    },
  );
  const [report, setReport] = useState<ConclusionReport | null>(initialReport ?? null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [pending, setPending] = useState(false);

  const selectedEvent = events.find((event) => event.eventId === eventId);
  const contentEditable = !report || canEditReportContent(report);

  async function persist(nextStatus?: "SUBMITTED") {
    setPending(true);
    setStatus("idle");

    try {
      let nextReport = report;

      if (!nextReport) {
        nextReport = await createConclusionReportRequest({
          content,
          eventId,
        });
      } else {
        nextReport = await updateConclusionReportRequest(nextReport.$id, {
          ...(contentEditable ? { content } : {}),
          status: nextStatus,
        });
      }

      if (nextStatus === "SUBMITTED" && nextReport.status !== "SUBMITTED") {
        nextReport = await updateConclusionReportRequest(nextReport.$id, {
          status: "SUBMITTED",
        });
      }

      setReport(nextReport);
      onChange(nextReport);
      setStatus("success");
      setMessage(nextStatus === "SUBMITTED" ? "Report submitted for approval." : "Draft saved.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save report.");
    } finally {
      setPending(false);
    }
  }

  const draftCandidate = {
    content,
    status: report?.status ?? "DRAFT",
  } as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-md border border-border bg-surface-subtle text-primary">
          <ClipboardList className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-text-secondary">Conclusion report</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-text-primary">
              {selectedEvent?.eventTitle ?? "Select an event"}
            </p>
            {report ? <Badge tone={reportStatusTone(report.status)}>{report.status}</Badge> : null}
          </div>
        </div>
      </div>

      {!initialReport ? (
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-text-secondary">Event</span>
          <select
            className={inputClasses}
            disabled={Boolean(report)}
            onChange={(event) => setEventId(event.target.value)}
            value={eventId}
          >
            {events.map((event) => (
              <option key={event.eventId} value={event.eventId}>
                {event.eventTitle} ({event.status})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="grid gap-4">
        <Field
          disabled={!contentEditable}
          label="Objectives"
          onChange={(value) => setContent((current) => ({ ...current, objectives: value }))}
          value={content.objectives}
        />
        <Field
          disabled={!contentEditable}
          label="Outcomes"
          onChange={(value) => setContent((current) => ({ ...current, outcomes: value }))}
          value={content.outcomes}
        />
        <Field
          disabled={!contentEditable}
          label="Challenges"
          onChange={(value) => setContent((current) => ({ ...current, challenges: value }))}
          value={content.challenges}
        />
        <Field
          disabled={!contentEditable}
          label="Recommendations"
          onChange={(value) =>
            setContent((current) => ({ ...current, recommendations: value }))
          }
          value={content.recommendations}
        />
        <Field
          disabled={!contentEditable}
          label="Attendance notes"
          onChange={(value) =>
            setContent((current) => ({ ...current, attendanceNotes: value }))
          }
          value={content.attendanceNotes}
        />
      </div>

      {message ? (
        <p
          className={
            status === "error"
              ? "rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
              : "rounded-md border border-success/25 bg-success-soft px-3 py-2 text-sm text-success"
          }
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {contentEditable ? (
          <Button disabled={pending} onClick={() => persist()} type="button">
            <Save className="size-4" aria-hidden="true" />
            Save draft
          </Button>
        ) : null}
        {contentEditable ? (
          <Button
            disabled={pending || !canSubmitReport(draftCandidate)}
            onClick={() => persist("SUBMITTED")}
            type="button"
            variant="primary"
          >
            <Send className="size-4" aria-hidden="true" />
            Submit for approval
          </Button>
        ) : null}
        {report && canExportConclusionReport(report) ? (
          <ExportActions kind="conclusion" reportId={report.$id} />
        ) : report ? (
          <ExportActions
            disabled
            disabledReason="Conclusion report exports are available only after approval."
            kind="conclusion"
            reportId={report.$id}
          />
        ) : null}
      </div>
    </div>
  );
}

function Field({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-text-secondary">{label}</span>
      <textarea
        className={textareaClasses}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}
