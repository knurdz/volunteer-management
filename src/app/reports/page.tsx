import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileText,
  Trophy,
  UsersRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { reportStatusTone } from "@/features/reports/lib/approval-rules";
import { ReportsNav } from "@/features/reports/components/reports-nav";
import { canAccessConclusionsTab } from "@/features/reports/lib/access";
import { getReportsPageData } from "@/features/reports/server/page-data";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

export default async function ReportsOverviewPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const canAccessConclusions = canAccessConclusionsTab(user);
  const data = await getReportsPageData(user);
  const pendingApproval = data.reports.filter((report) => report.status === "SUBMITTED").length;
  const approvedReports = data.reports.filter((report) => report.status === "APPROVED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reporting"
        title={user.isAdmin ? "Reports & Exports" : "Reports"}
        description={
          user.isAdmin
            ? "Event summaries, conclusion reports, recognition, and volunteer profile PDF generation."
            : "Recognition and conclusion reports."
        }
      />

      <ReportsNav canAccessConclusions={canAccessConclusions} isAdmin={user.isAdmin} />

      {user.isAdmin ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Event summaries" value={String(data.summaries.length)} />
          <StatCard label="Conclusion reports" value={String(data.reports.length)} />
          <StatCard label="Awaiting approval" value={String(pendingApproval)} />
          <StatCard label="Volunteer profiles" value={String(data.volunteers.length)} />
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {user.isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                Event summaries
              </CardTitle>
              <CardDescription>
                Events derived from active role assignments and report status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.summaries.map((summary) => (
                <div
                  className="rounded-md border border-border bg-surface-subtle px-4 py-3"
                  key={summary.eventId}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-text-primary">{summary.eventTitle}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="primary">{summary.status}</Badge>
                      {summary.reportStatus ? (
                        <Badge tone={reportStatusTone(summary.reportStatus)}>
                          {summary.reportStatus}
                        </Badge>
                      ) : (
                        <Badge>No report</Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{summary.summary}</p>
                </div>
              ))}
              <Link className={buttonClasses()} href="/reports/conclusions">
                Manage conclusion reports
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <Card className={user.isAdmin ? undefined : "lg:col-span-2"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" aria-hidden="true" />
              Recognition snapshot
            </CardTitle>
            <CardDescription>Points-based recognition is not connected yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {data.volunteerOfTheMonth ? (
              <div className="rounded-md border border-border bg-surface-subtle px-4 py-3">
                <p className="font-medium text-text-secondary">Volunteer of the Month</p>
                <p className="mt-1 text-lg font-semibold text-text-primary">
                  {data.volunteerOfTheMonth.name}
                </p>
                <p className="mt-1 text-text-secondary">{data.volunteerOfTheMonth.highlight}</p>
              </div>
            ) : (
              <p className="text-text-secondary">
                Volunteer of the Month will appear once the points ledger is connected.
              </p>
            )}
            {data.hallOfFame[0] ? (
              <div>
                <p className="font-medium text-text-secondary">Hall of Fame leader</p>
                <p className="mt-1 text-text-primary">
                  {data.hallOfFame[0].name} — {data.hallOfFame[0].pointsEarned} points
                </p>
              </div>
            ) : (
              <p className="text-text-secondary">Hall of Fame rankings are not available yet.</p>
            )}
            <Link className={buttonClasses()} href="/reports/recognition">
              View recognition
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {user.isAdmin || canAccessConclusions ? (
        <section className="grid gap-4 md:grid-cols-3">
          {canAccessConclusions ? (
            <QuickLinkCard
              description="Create and submit structured text conclusion reports."
              href="/reports/conclusions"
              icon={ClipboardList}
              title="Conclusion reports"
            />
          ) : null}
          {user.isAdmin ? (
            <QuickLinkCard
              description={`Review submitted reports. ${pendingApproval} awaiting approval, ${approvedReports} approved.`}
              href="/reports/approval"
              icon={FileText}
              title="Admin approval"
            />
          ) : null}
          {user.isAdmin ? (
            <QuickLinkCard
              description="Export volunteer identity, roles, and participation."
              href="/reports/volunteers"
              icon={UsersRound}
              title="Volunteer PDFs"
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle px-4 py-3">
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function QuickLinkCard({
  description,
  href,
  icon: Icon,
  title,
}: {
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link className={buttonClasses({ variant: "primary" })} href={href}>
          Open
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
