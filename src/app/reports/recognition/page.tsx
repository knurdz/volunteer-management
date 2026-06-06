import { Award, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportsNav } from "@/features/reports/components/reports-nav";
import { getReportsPageData } from "@/features/reports/server/page-data";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

export default async function RecognitionPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const data = await getReportsPageData(user);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reporting"
        title="Recognition"
        description="Volunteer of the Month and Hall of Fame views will appear once points data is connected."
      />

      <ReportsNav isAdmin={user.isAdmin} />

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-4 text-primary" aria-hidden="true" />
              Volunteer of the Month
            </CardTitle>
            <CardDescription>Recognition data unavailable</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.volunteerOfTheMonth ? (
              <>
                <p className="text-xl font-semibold text-text-primary">
                  {data.volunteerOfTheMonth.name}
                </p>
                <p className="text-text-secondary">{data.volunteerOfTheMonth.highlight}</p>
                <Badge tone="success">{data.volunteerOfTheMonth.pointsEarned} points earned</Badge>
              </>
            ) : (
              <p className="text-text-secondary">
                Volunteer of the Month will appear here once the points ledger is connected.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" aria-hidden="true" />
              Yearly Hall of Fame
            </CardTitle>
            <CardDescription>Recognition data unavailable</CardDescription>
          </CardHeader>
          <CardContent>
            {data.hallOfFame.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="min-w-[520px] divide-y divide-border text-left text-sm">
                  <thead className="bg-surface-muted text-text-secondary">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Rank</th>
                      <th className="px-4 py-3 font-semibold">Volunteer</th>
                      <th className="px-4 py-3 font-semibold">Term</th>
                      <th className="px-4 py-3 font-semibold">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {data.hallOfFame.map((entry) => (
                      <tr key={entry.userId}>
                        <td className="px-4 py-3 font-medium text-text-primary">
                          #{entry.rank}
                        </td>
                        <td className="px-4 py-3 text-text-primary">{entry.name}</td>
                        <td className="px-4 py-3 text-text-secondary">{entry.term.label}</td>
                        <td className="px-4 py-3">
                          <Badge tone="primary">{entry.pointsEarned}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                Hall of Fame rankings will appear here once the points ledger is connected.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
