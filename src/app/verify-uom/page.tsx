import Link from "next/link";
import { redirect } from "next/navigation";
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
import { VerificationPanel } from "@/features/uom-verification/components/verification-panel";
import { getCurrentUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function VerifyUomPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Verify UoM email"
          description="Minimal Developer 1 test UI for the adapter-backed verification flow."
          actions={
            <Link className={buttonClasses()} href="/dashboard">
              Back to dashboard
            </Link>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>Verification</CardTitle>
            <CardDescription>
              In development, the mock email adapter returns the code here for testing.
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
