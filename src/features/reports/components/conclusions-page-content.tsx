"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConclusionReportForm } from "@/features/reports/components/conclusion-report-form";
import { reportStatusTone } from "@/features/reports/lib/approval-rules";
import type { ConclusionReport, MockEvent } from "@/features/reports/types";
import { ClipboardList } from "lucide-react";

export function ConclusionsPageContent({
  actorName,
  actorUserId,
  events,
  initialReport,
  initialReports,
}: {
  actorName: string;
  actorUserId: string;
  events: MockEvent[];
  initialReport: ConclusionReport | null;
  initialReports: ConclusionReport[];
}) {
  const [reports, setReports] = useState(initialReports);
  const draftEvent = events.find((event) => event.status === "PENDING_CONCLUSION");

  function handleReportChange(report: ConclusionReport) {
    setReports((current) => {
      const exists = current.some((entry) => entry.$id === report.$id);
      return exists
        ? current.map((entry) => (entry.$id === report.$id ? report : entry))
        : [...current, report];
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" aria-hidden="true" />
            Active draft
          </CardTitle>
          <CardDescription>
            {draftEvent
              ? `${draftEvent.eventTitle} is pending conclusion.`
              : "No event is currently pending conclusion."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConclusionReportForm
            actorName={actorName}
            actorUserId={actorUserId}
            events={events}
            initialReport={initialReport}
            onChange={handleReportChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All mock reports</CardTitle>
          <CardDescription>Existing conclusion reports in the in-memory mock store.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-[760px] divide-y divide-border text-left text-sm">
              <thead className="bg-surface-muted text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Submitted by</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {reports.map((report) => (
                  <tr key={report.$id}>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {report.eventTitle}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{report.submittedByName}</td>
                    <td className="px-4 py-3">
                      <Badge tone={reportStatusTone(report.status)}>{report.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(report.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
