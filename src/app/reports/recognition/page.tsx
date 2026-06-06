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
  const data = getReportsPageData();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reporting"
        title="Recognition"
        description="Volunteer of the Month and yearly Hall of Fame views using mock points data."
      />

      <ReportsNav isAdmin={user.isAdmin} />

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-4 text-primary" aria-hidden="true" />
              Volunteer of the Month
            </CardTitle>
            <CardDescription>
              {data.volunteerOfTheMonth.month} {data.volunteerOfTheMonth.year}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xl font-semibold text-text-primary">
              {data.volunteerOfTheMonth.name}
            </p>
            <p className="text-text-secondary">{data.volunteerOfTheMonth.highlight}</p>
            <Badge tone="success">{data.volunteerOfTheMonth.pointsEarned} points earned</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" aria-hidden="true" />
              Yearly Hall of Fame
            </CardTitle>
            <CardDescription>IEEE term {data.hallOfFame[0]?.term.label}</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
