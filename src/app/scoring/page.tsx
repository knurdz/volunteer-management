import { requireAuth } from "@/features/access-control/server/current-user";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ScoringDashboard } from "@/features/scoring/components/scoring-dashboard";

export const dynamic = "force-dynamic";

export default async function ScoringPage() {
  const user = await requireAuth();

  return (
    <AppShell active="scoring" user={user}>
      <div className="space-y-6">
        <PageHeader
          title="Scoring & Leaderboard"
          description="Track volunteer contributions, manage participation, enter grades, and view points standings."
        />
        <ScoringDashboard user={user} />
      </div>
    </AppShell>
  );
}
