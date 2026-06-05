import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { getVolunteerProfileSummary } from "@/features/volunteers/server/profiles";
import { listVisibleRecommendationsForVolunteer } from "@/features/recommendations/server/recommendations";
import { RecommendationList } from "@/features/recommendations/components/recommendation-list";
import { RecommendationRequestForm } from "@/features/recommendations/components/recommendation-request-form";

export const dynamic = "force-dynamic";

export default async function VolunteerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { userId } = await params;
  const [profile, recommendations] = await Promise.all([
    getVolunteerProfileSummary(userId),
    listVisibleRecommendationsForVolunteer(userId),
  ]);

  if (!profile) {
    return (
      <AppShell active="volunteers" user={user}>
        <PageHeader
          title="Volunteer Not Found"
          description="No platform profile exists for this user ID."
        />
      </AppShell>
    );
  }
  const canRequestRecommendation =
    user.profile.uomVerified && profile.uomVerified && user.authUser.id !== profile.userId;
  const canReportRecommendations = user.profile.uomVerified;
  const profileDisplayName = profile.name || profile.googleEmail;

  return (
    <AppShell active="volunteers" user={user}>
      <div className="space-y-6">
        <PageHeader
          title={profileDisplayName}
          description={profile.details?.headline ?? "Internal volunteer profile"}
        />

        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-4 text-primary" aria-hidden="true" />
                Identity
              </CardTitle>
              <CardDescription>Account and verification state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="Google email" value={profile.googleEmail} />
              <InfoRow label="UoM email" value={profile.uomEmail ?? "Not verified"} />
              <Badge tone={profile.uomVerified ? "success" : "warning"}>
                {profile.uomVerified ? "UoM verified" : "UoM not verified"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contribution Summary</CardTitle>
              <CardDescription>Participation and points will connect after later features.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-text-secondary">
              <p>{profile.details?.bio ?? "No volunteer bio has been added yet."}</p>
              <InfoRow label="Skills" value={profile.details?.skills ?? "Not provided"} />
              <InfoRow label="LinkedIn" value={profile.details?.linkedinUrl ?? "Not provided"} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Student Branch and event responsibilities.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {profile.sbRoles.length > 0 ? (
                profile.sbRoles.map((role) => <Badge key={role}>{role}</Badge>)
              ) : (
                <Badge>No SB roles</Badge>
              )}
            </div>
            <div className="grid gap-2 text-sm text-text-secondary">
              {profile.eventRoles.length > 0 ? (
                profile.eventRoles.map((role) => (
                  <div className="rounded-md border border-border p-3" key={`${role.eventId}-${role.role}`}>
                    <p className="font-medium text-text-primary">{role.eventTitle}</p>
                    <p>{[role.role, role.committeeName].filter(Boolean).join(" · ")}</p>
                  </div>
                ))
              ) : (
                <p>No event responsibilities assigned.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>
              Visible recommendation history and request actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canRequestRecommendation ? (
              <RecommendationRequestForm
                respondentId={profile.userId}
                respondentName={profileDisplayName}
              />
            ) : null}
            {!user.profile.uomVerified ? (
              <p className="text-sm text-text-secondary">
                Verify your UoM email before requesting or reporting recommendations.
              </p>
            ) : null}
            <RecommendationList
              canReport={canReportRecommendations}
              initialRecommendations={recommendations}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="font-medium text-text-secondary">{label}</span>
      <span className="break-words text-text-primary">{value}</span>
    </div>
  );
}
