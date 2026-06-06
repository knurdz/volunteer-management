import { UsersRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExportActions } from "@/features/reports/components/export-actions";
import { ReportsNav } from "@/features/reports/components/reports-nav";
import { getReportsPageData } from "@/features/reports/server/page-data";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

export default async function VolunteersPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const data = await getReportsPageData(user);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reporting"
        title="Volunteer Profile Exports"
        description="Export volunteer summaries as formal PDFs from Appwrite profile and role data."
      />

      <ReportsNav isAdmin={user.isAdmin} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="size-4 text-primary" aria-hidden="true" />
            Volunteer profiles
          </CardTitle>
          <CardDescription>
            Identity, roles, participation, and optional Thesaru points when available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-[980px] divide-y divide-border text-left text-sm">
              <thead className="bg-surface-muted text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Volunteer</th>
                  <th className="px-4 py-3 font-semibold">SB roles</th>
                  <th className="px-4 py-3 font-semibold">Participation</th>
                  <th className="px-4 py-3 font-semibold">Recommendations</th>
                  <th className="px-4 py-3 font-semibold">Points</th>
                  <th className="px-4 py-3 font-semibold">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {data.volunteers.map((volunteer) => (
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
                    <td className="px-4 py-3 text-text-secondary">
                      {volunteer.recommendations.length > 0
                        ? volunteer.recommendations.length
                        : "Unavailable"}
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
    </div>
  );
}
