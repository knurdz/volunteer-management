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

  const { userId } = await params;
  const profile = await getVolunteerProfileSummary(userId, { viewer: user });

  if (!profile) {
    if (!user) {
      return (
        <PublicVolunteerLayout>
          <PageHeader
            title="Volunteer Not Found"
            description="No active verified volunteer profile exists for this user ID."
          />
        </PublicVolunteerLayout>
      );
    }

    return (
      <AppShell active="volunteers" user={user}>
        <PageHeader
          title="Volunteer Not Found"
          description="No active verified volunteer profile exists for this user ID."
        />
      </AppShell>
    );
  }
  const canRequestRecommendation =
    Boolean(user?.profile.uomVerified) && user?.authUser.id !== profile.userId;
  const canReportRecommendations = Boolean(user?.profile.uomVerified);
  const profileDisplayName = profile.name || "Verified volunteer";
  const recommendations = await listVisibleRecommendationsForVolunteer(userId);
  const content = (
    <VolunteerProfileContent
      canReportRecommendations={canReportRecommendations}
      canRequestRecommendation={canRequestRecommendation}
      profile={profile}
      profileDisplayName={profileDisplayName}
      recommendations={recommendations}
      userIsUnverified={Boolean(user && !user.profile.uomVerified)}
    />
  );

  if (!user) {
    return <PublicVolunteerLayout>{content}</PublicVolunteerLayout>;
  }

  return (
    <AppShell active="volunteers" user={user}>
      {content}
    </AppShell>
  );
}

function VolunteerProfileContent({
  canReportRecommendations,
  canRequestRecommendation,
  profile,
  profileDisplayName,
  recommendations,
  userIsUnverified,
}: {
  canReportRecommendations: boolean;
  canRequestRecommendation: boolean;
  profile: NonNullable<Awaited<ReturnType<typeof getVolunteerProfileSummary>>>;
  profileDisplayName: string;
  recommendations: Awaited<ReturnType<typeof listVisibleRecommendationsForVolunteer>>;
  userIsUnverified: boolean;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={profileDisplayName}
        description={profile.details?.headline ?? "Volunteer profile"}
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
              {profile.isPrivateView ? (
                <>
                  <InfoRow label="Google email" value={profile.googleEmail ?? "Hidden"} />
                  <InfoRow label="UoM email" value={profile.uomEmail ?? "Hidden"} />
                </>
              ) : null}
              <InfoRow label="University index" value={profile.details?.universityIndex ?? "Not provided"} />
              <InfoRow label="Faculty" value={profile.details?.faculty ?? "Not provided"} />
              <InfoRow label="Department" value={profile.details?.department ?? "Not provided"} />
              <InfoRow label="Batch / Year" value={profile.details?.batchYear ?? "Not provided"} />
              <InfoRow label="IEEE Membership" value={profile.details?.ieeeMembership ?? "Not provided"} />
              <Badge tone="success">Active verified volunteer</Badge>
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
            {userIsUnverified ? (
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
  );
}

function PublicVolunteerLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        {children}
      </div>
    </main>
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
