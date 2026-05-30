import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, MailCheck } from "lucide-react";
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
import { VerificationPanel } from "@/features/uom-verification/components/verification-panel";
import { getCurrentUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function VerifyUomPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell active="verification" user={user}>
      <div className="space-y-6">
        <PageHeader
          title="UoM Email Verification"
          description="Confirm a university email address before volunteer access is enabled."
          actions={
            <Link className={buttonClasses()} href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Overview
            </Link>
          }
        />
        {user.profile.uomVerified ? (
          <Card>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-success/20 bg-success-soft text-success">
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-text-primary">
                    University email verified
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {user.profile.uomEmail}
                  </p>
                </div>
              </div>
              <Badge tone="success">Verified</Badge>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailCheck className="size-4 text-primary" aria-hidden="true" />
              Verification Request
            </CardTitle>
            <CardDescription>
              A one-time code will be sent to the entered{" "}
              <span className="font-medium">@uom.lk</span> mailbox.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VerificationPanel />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
