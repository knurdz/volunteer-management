import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ConclusionsPageContent } from "@/features/reports/components/conclusions-page-content";
import { ReportsNav } from "@/features/reports/components/reports-nav";
import { canAccessConclusionsTab } from "@/features/reports/lib/access";
import { getReportsPageData } from "@/features/reports/server/page-data";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

export default async function ConclusionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  if (!canAccessConclusionsTab(user)) {
    redirect("/reports/recognition");
  }

  const data = await getReportsPageData(user);
  const draftEvent = data.events.find((event) => event.status === "PENDING_CONCLUSION");
  const draftReport =
    data.reports.find((report) => report.eventId === draftEvent?.eventId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reporting"
        title="Conclusion Reports"
        description="Structured text-only event conclusion forms backed by Appwrite records."
      />

      <ReportsNav
        canAccessConclusions={canAccessConclusionsTab(user)}
        isAdmin={user.isAdmin}
      />

      <ConclusionsPageContent
        events={data.events.filter((event) => event.status === "PENDING_CONCLUSION")}
        initialReport={draftReport}
        initialReports={data.reports}
      />
    </div>
  );
}
