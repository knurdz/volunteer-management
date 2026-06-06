import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConclusionApprovalPanel } from "@/features/reports/components/conclusion-approval-panel";
import { ReportsNav } from "@/features/reports/components/reports-nav";
import { getReportsPageData } from "@/features/reports/server/page-data";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

export default async function ApprovalPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin) {
    redirect("/reports");
  }

  const data = getReportsPageData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reporting"
        title="Admin Approval"
        description="Review submitted conclusion reports. PDF export is enabled only after approval."
      />

      <ReportsNav isAdmin={user.isAdmin} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" aria-hidden="true" />
            Conclusion report workflow
          </CardTitle>
          <CardDescription>
            Approve or reject submitted reports, then export approved reports as PDF.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConclusionApprovalPanel
            initialReports={data.reports}
            reviewerName={user.authUser.name || user.authUser.email}
            reviewerUserId={user.authUser.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
