import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Flag } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { ReportedRecommendationsPanel } from "@/features/recommendations/components/reported-recommendations-panel";
import { listReportedRecommendations } from "@/features/recommendations/server/recommendations";

export const dynamic = "force-dynamic";

export default async function AdminRecommendationsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const recommendations = await listReportedRecommendations();

  return (
    <AppShell active="moderation" user={currentUser}>
      <div className="space-y-6">
        <PageHeader
          title="Recommendation Moderation"
          description="Review reported recommendation text and hide content when needed."
          actions={
            <Link className={buttonClasses()} href="/admin/users">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Access Control
            </Link>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="size-4 text-primary" aria-hidden="true" />
              Reported Recommendations
            </CardTitle>
            <CardDescription>
              Hiding a recommendation preserves the original report reason and stores a separate hide reason.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReportedRecommendationsPanel initialRecommendations={recommendations} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
