import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Developer 1 test dashboard"
          description="Minimal UI for checking auth, UoM verification, Admin status, and SB roles."
          actions={
            <>
              <Link className={buttonClasses()} href="/verify-uom">
                Verify UoM Email
              </Link>
              {user.isAdmin ? (
                <Link
                  className={buttonClasses({ variant: "primary" })}
                  href="/admin/users"
                >
                  Admin Users
                </Link>
              ) : null}
              <form action="/api/auth/logout" method="post">
                <Button type="submit" variant="ghost">
                  Logout
                </Button>
              </form>
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Current Account</CardTitle>
              <CardDescription>Appwrite auth and profile bootstrap status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="User ID" value={user.authUser.id} />
              <InfoRow label="Google email" value={user.authUser.email} />
              <InfoRow label="Name" value={user.authUser.name || "Not provided"} />
              <InfoRow label="Profile status" value={user.profile.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access State</CardTitle>
              <CardDescription>Server-side guard inputs for future features.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge tone={user.isAdmin ? "success" : "neutral"}>
                  {user.isAdmin ? "Admin" : "Not Admin"}
                </Badge>
                <Badge tone={user.profile.uomVerified ? "success" : "warning"}>
                  {user.profile.uomVerified ? "UoM verified" : "UoM not verified"}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">SB roles</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user.sbRoles.length > 0 ? (
                    user.sbRoles.map((role) => (
                      <Badge key={role} tone="primary">
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <Badge>No assigned SB roles</Badge>
                  )}
                </div>
              </div>
              <InfoRow
                label="Verified UoM email"
                value={user.profile.uomEmail ?? "Not verified yet"}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="font-medium text-text-secondary">{label}</span>
      <span className="break-all text-text-primary">{value}</span>
    </div>
  );
}
