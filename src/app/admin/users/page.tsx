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
import { UsersAdminPanel } from "@/features/admin/components/users-admin-panel";
import { listAdminUsers } from "@/server/admin/users";
import { getCurrentUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const users = await listAdminUsers();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Admin users"
          description="Minimal UI for checking profile bootstrap and SB role assignment."
          actions={
            <Link className={buttonClasses()} href="/dashboard">
              Back to dashboard
            </Link>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>Profiles and roles</CardTitle>
            <CardDescription>
              The single Admin controls all Student Branch privileges.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsersAdminPanel initialUsers={users} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
