import { PageHeader } from "@/components/layout/page-header";
import { ConclusionsPageContent } from "@/features/reports/components/conclusions-page-content";
import { ReportsNav } from "@/features/reports/components/reports-nav";
import { getReportsPageData } from "@/features/reports/server/page-data";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

export default async function ConclusionsPage() {
  const user = await getCurrentUser();
  const data = getReportsPageData();

  if (!user) {
    return null;
  }

  const draftEvent = data.events.find((event) => event.status === "PENDING_CONCLUSION");
  const draftReport =
    data.reports.find((report) => report.eventId === draftEvent?.eventId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reporting"
        title="Conclusion Reports"
        description="Structured text-only event conclusion forms connected to mock event records."
      />

      <ReportsNav isAdmin={user.isAdmin} />

      <ConclusionsPageContent
        actorName={user.authUser.name || user.authUser.email}
        actorUserId={user.authUser.id}
        events={data.events.filter((event) => event.status === "PENDING_CONCLUSION")}
        initialReport={draftReport}
        initialReports={data.reports}
      />
    </div>
  );
}
