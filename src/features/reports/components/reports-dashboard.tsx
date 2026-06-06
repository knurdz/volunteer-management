"use client";

import { useMemo, useState } from "react";
import {
  Award,
  CalendarDays,
  ClipboardList,
  FileText,
  Trophy,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { reportStatusTone } from "@/features/reports/lib/approval-rules";
import type {
  ConclusionReport,
  EventSummary,
  HallOfFameEntry,
  MockEvent,
  VolunteerOfTheMonth,
  VolunteerProfileExport,
} from "@/features/reports/types";
import { ConclusionApprovalPanel } from "@/features/reports/components/conclusion-approval-panel";
import { ConclusionReportForm } from "@/features/reports/components/conclusion-report-form";
import { ExportActions } from "@/features/reports/components/export-actions";

type DashboardMode = "summaries" | "conclusions" | "approval" | "recognition" | "volunteers";

type ReportsDashboardProps = {
  actorName: string;
  actorUserId: string;
  events: MockEvent[];
  hallOfFame: HallOfFameEntry[];
  initialReports: ConclusionReport[];
  isAdmin: boolean;
  summaries: EventSummary[];
  volunteerOfTheMonth: VolunteerOfTheMonth;
  volunteers: VolunteerProfileExport[];
};

export function ReportsDashboard({
  actorName,
  actorUserId,
  events,
  hallOfFame,
  initialReports,
  isAdmin,
  summaries,
  volunteerOfTheMonth,
  volunteers,
}: ReportsDashboardProps) {
  const [mode, setMode] = useState<DashboardMode>("summaries");
  const [reports, setReports] = useState(initialReports);
  const draftEvent = useMemo(
    () => events.find((event) => event.status === "PENDING_CONCLUSION"),
    [events],
  );
  const draftReport =
    reports.find((report) => report.eventId === draftEvent?.eventId) ?? null;

  const modes: Array<{ id: DashboardMode; label: string; icon: typeof CalendarDays }> = [
    { icon: CalendarDays, id: "summaries", label: "Event summaries" },
    { icon: ClipboardList, id: "conclusions", label: "Conclusion reports" },
    ...(isAdmin
      ? [{ icon: FileText, id: "approval" as const, label: "Admin approval" }]
      : []),
    { icon: Award, id: "recognition", label: "Recognition" },
    { icon: UsersRound, id: "volunteers", label: "Volunteer exports" },
  ];

  return (
    <div className="space-y-5">
      <div className="inline-flex flex-wrap gap-2 rounded-md border border-border bg-surface p-1">
        {modes.map((entry) => {
          const Icon = entry.icon;
          const isActive = mode === entry.id;

          return (
            <button
              className={
                isActive
                  ? "inline-flex h-10 items-center gap-2 rounded-md border border-primary/30 bg-primary-soft px-3 text-sm font-medium text-primary"
                  : "inline-flex h-10 items-center gap-2 rounded-md border border-transparent px-3 text-sm font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              }
              key={entry.id}
              onClick={() => setMode(entry.id)}
              type="button"
            >
              <Icon className="size-4" aria-hidden="true" />
              {entry.label}
            </button>
          );
        })}
      </div>

      {mode === "summaries" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {summaries.map((summary) => (
            <Card key={summary.eventId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                  {summary.eventTitle}
                </CardTitle>
                <CardDescription>{summary.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="primary">{summary.status}</Badge>
                  {summary.reportStatus ? (
                    <Badge tone={reportStatusTone(summary.reportStatus)}>
                      Report {summary.reportStatus}
                    </Badge>
                  ) : (
                    <Badge>No report</Badge>
                  )}
                </div>
                <p className="text-text-secondary">
                  Held on {new Date(summary.heldOn).toLocaleDateString()} ·{" "}
                  {summary.volunteerCount} volunteers
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {mode === "conclusions" ? (
        <Card>
          <CardHeader>
            <CardTitle>Structured conclusion report</CardTitle>
            <CardDescription>
              Text-only event conclusions connected to mock event records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConclusionReportForm
              actorName={actorName}
              actorUserId={actorUserId}
              events={events.filter((event) => event.status === "PENDING_CONCLUSION")}
              initialReport={draftReport}
              onChange={(report) =>
                setReports((current) => {
                  const exists = current.some((entry) => entry.$id === report.$id);
                  return exists
                    ? current.map((entry) => (entry.$id === report.$id ? report : entry))
                    : [...current, report];
                })
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {mode === "approval" && isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Admin approval workflow</CardTitle>
            <CardDescription>
              Review submitted conclusion reports before PDF export is enabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConclusionApprovalPanel
              initialReports={reports}
              reviewerName={actorName}
              reviewerUserId={actorUserId}
            />
          </CardContent>
        </Card>
      ) : null}

      {mode === "recognition" ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="size-4 text-primary" aria-hidden="true" />
                Volunteer of the Month
              </CardTitle>
              <CardDescription>
                {volunteerOfTheMonth.month} {volunteerOfTheMonth.year}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-lg font-semibold text-text-primary">
                {volunteerOfTheMonth.name}
              </p>
              <p className="text-text-secondary">{volunteerOfTheMonth.highlight}</p>
              <Badge tone="success">{volunteerOfTheMonth.pointsEarned} points earned</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-4 text-primary" aria-hidden="true" />
                Yearly Hall of Fame
              </CardTitle>
              <CardDescription>IEEE term {hallOfFame[0]?.term.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="min-w-[520px] divide-y divide-border text-left text-sm">
                  <thead className="bg-surface-muted text-text-secondary">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Rank</th>
                      <th className="px-4 py-3 font-semibold">Volunteer</th>
                      <th className="px-4 py-3 font-semibold">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {hallOfFame.map((entry) => (
                      <tr key={entry.userId}>
                        <td className="px-4 py-3 font-medium text-text-primary">
                          #{entry.rank}
                        </td>
                        <td className="px-4 py-3 text-text-primary">{entry.name}</td>
                        <td className="px-4 py-3">
                          <Badge tone="primary">{entry.pointsEarned}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {mode === "volunteers" ? (
        <Card>
          <CardHeader>
            <CardTitle>Volunteer profile exports</CardTitle>
            <CardDescription>
              Identity, roles, participation, recommendations, and points when available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-[920px] divide-y divide-border text-left text-sm">
                <thead className="bg-surface-muted text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Volunteer</th>
                    <th className="px-4 py-3 font-semibold">SB roles</th>
                    <th className="px-4 py-3 font-semibold">Participation</th>
                    <th className="px-4 py-3 font-semibold">Points</th>
                    <th className="px-4 py-3 font-semibold">Export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {volunteers.map((volunteer) => (
                    <tr key={volunteer.userId}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{volunteer.name}</p>
                        <p className="mt-1 text-xs text-text-muted">{volunteer.uomEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {volunteer.sbRoles.length > 0 ? (
                            volunteer.sbRoles.map((role) => (
                              <Badge key={role} tone="primary">
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <Badge>None</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {volunteer.participations.length} event
                        {volunteer.participations.length === 1 ? "" : "s"}
                      </td>
                      <td className="px-4 py-3">
                        {volunteer.pointsLedger ? (
                          <Badge tone="success">{volunteer.pointsLedger.total}</Badge>
                        ) : (
                          <Badge tone="warning">Unavailable</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ExportActions kind="volunteer" userId={volunteer.userId} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
