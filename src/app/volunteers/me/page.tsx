import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, MailCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { getVolunteerProfileDetails } from "@/features/volunteers/server/profiles";
import { ProfileDetailsForm } from "@/features/volunteers/components/profile-details-form";
import { RecommendationRequestsPanel } from "@/features/recommendations/components/recommendation-requests-panel";
import { listRecommendationRequestsForVolunteer } from "@/features/recommendations/server/recommendations";

export const dynamic = "force-dynamic";

export default async function MyVolunteerProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const details = user.profile.uomVerified
    ? await getVolunteerProfileDetails(user.authUser.id)
    : null;
  const recommendationRequests = user.profile.uomVerified
    ? await listRecommendationRequestsForVolunteer(user.authUser.id)
    : { incoming: [], outgoing: [] };

  return (
    <AppShell active="volunteers" user={user}>
      <div className="space-y-6">
        <PageHeader
          title="Volunteer Profile"
          description="Manage the extra details shown on your internal volunteer profile."
          actions={
            <>
              <Link className={buttonClasses({ variant: "secondary" })} href="/verify-uom">
                <MailCheck className="size-4" aria-hidden="true" />
                Verification
              </Link>
              <Link className={buttonClasses()} href={`/volunteers/${user.authUser.id}`}>
                <Eye className="size-4" aria-hidden="true" />
                View Profile
              </Link>
            </>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>
              These fields are separate from your Appwrite login identity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.profile.uomVerified ? (
              <ProfileDetailsForm initialDetails={details} />
            ) : (
              <div className="space-y-3">
                <Badge tone="warning">UoM verification required</Badge>
                <p className="text-sm text-text-secondary">
                  Verify your UoM email before creating volunteer profile details.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommendation Requests</CardTitle>
            <CardDescription>
              Track pending requests and write recommendations for other verified volunteers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.profile.uomVerified ? (
              <RecommendationRequestsPanel initialRequests={recommendationRequests} />
            ) : (
              <p className="text-sm text-text-secondary">
                Verify your UoM email before requesting or writing recommendations.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
