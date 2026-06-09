"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canApproveReport,
  canExportConclusionReport,
  reportStatusTone,
} from "@/features/reports/lib/approval-rules";
import {
  reopenConclusionReportRequest,
  reviewConclusionReportRequest,
} from "@/features/reports/lib/api-client";
import type { ConclusionReport } from "@/features/reports/types";
import { ExportActions } from "@/features/reports/components/export-actions";

const inputClasses =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary";

type ConclusionApprovalPanelProps = {
  initialReports: ConclusionReport[];
};

export function ConclusionApprovalPanel({ initialReports }: ConclusionApprovalPanelProps) {
  const [reports, setReports] = useState(initialReports);
  const [selectedId, setSelectedId] = useState(
    initialReports.find((report) => report.status === "SUBMITTED")?.$id ??
      initialReports[0]?.$id ??
      "",
  );
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [pending, setPending] = useState(false);

  const selectedReport = reports.find((report) => report.$id === selectedId) ?? null;
  const pendingReports = reports.filter((report) => report.status === "SUBMITTED");

  async function review(nextStatus: "APPROVED" | "REJECTED") {
    if (!selectedReport || !canApproveReport(selectedReport)) {
      return;
    }

    setPending(true);
    setStatus("idle");

    try {
      const { report } = await reviewConclusionReportRequest(selectedReport.$id, {
        reviewNote: reviewNote || undefined,
        status: nextStatus,
      });

      setReports((current) =>
        current.map((entry) => (entry.$id === report.$id ? report : entry)),
      );
      setReviewNote("");
      setStatus("success");
      setMessage(`Report ${nextStatus.toLowerCase()}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Review failed.");
    } finally {
      setPending(false);
    }
  }

  async function reopen() {
    if (!selectedReport || selectedReport.status === "DRAFT") {
      return;
    }

    setPending(true);
    setStatus("idle");

    try {
      const report = await reopenConclusionReportRequest(selectedReport.$id);

      setReports((current) =>
        current.map((entry) => (entry.$id === report.$id ? report : entry)),
      );
      setStatus("success");
      setMessage("Report reopened to draft.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Reopen failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryTile label="Total reports" value={String(reports.length)} />
        <SummaryTile label="Awaiting review" value={String(pendingReports.length)} />
        <SummaryTile
          label="Approved"
          value={String(reports.filter((report) => report.status === "APPROVED").length)}
        />
      </section>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-[920px] divide-y divide-border text-left text-sm">
          <thead className="bg-surface-muted text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Submitted by</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {reports.map((report) => (
              <tr key={report.$id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-text-primary">{report.eventTitle}</p>
                  <p className="mt-1 text-xs text-text-muted">{report.eventId}</p>
                </td>
                <td className="px-4 py-3 text-text-secondary">{report.submittedByName}</td>
                <td className="px-4 py-3">
                  <Badge tone={reportStatusTone(report.status)}>{report.status}</Badge>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {new Date(report.updatedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Button onClick={() => setSelectedId(report.$id)} type="button">
                    Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedReport ? (
        <section className="rounded-md border border-border bg-surface-subtle p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-text-secondary">Selected report</p>
              <h3 className="mt-1 text-lg font-semibold text-text-primary">
                {selectedReport.eventTitle}
              </h3>
            </div>
            {canExportConclusionReport(selectedReport) ? (
              <ExportActions kind="conclusion" reportId={selectedReport.$id} />
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ReviewBlock label="Objectives" value={selectedReport.content.objectives} />
            <ReviewBlock label="Outcomes" value={selectedReport.content.outcomes} />
            <ReviewBlock label="Challenges" value={selectedReport.content.challenges} />
            <ReviewBlock
              label="Recommendations"
              value={selectedReport.content.recommendations}
            />
            <ReviewBlock
              label="Attendance notes"
              value={selectedReport.content.attendanceNotes}
            />
          </div>

          {canApproveReport(selectedReport) ? (
            <div className="mt-4 space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-text-secondary">Review note</span>
                <textarea
                  className={inputClasses}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="Optional note for the submitter"
                  value={reviewNote}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending}
                  onClick={() => review("APPROVED")}
                  type="button"
                  variant="primary"
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Approve
                </Button>
                <Button disabled={pending} onClick={() => review("REJECTED")} type="button">
                  <XCircle className="size-4" aria-hidden="true" />
                  Reject
                </Button>
              </div>
            </div>
          ) : null}

          {selectedReport.status !== "DRAFT" ? (
            <div className="mt-4">
              <Button disabled={pending} onClick={reopen} type="button" variant="secondary">
                <RotateCcw className="size-4" aria-hidden="true" />
                Reopen to draft
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

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
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle px-4 py-3">
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function ReviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      <p className="mt-2 text-sm leading-6 text-text-primary">{value || "Not provided."}</p>
    </div>
  );
}
