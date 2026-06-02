import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UsersRound } from "lucide-react";
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
import { AccessControlPanel } from "@/features/access-control/components/access-control-panel";
import { listAdminUsers } from "@/features/access-control/server/admin-users";
import { getCurrentUser } from "@/features/access-control/server/current-user";

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
    <AppShell active="users" user={currentUser}>
      <div className="space-y-6">
        <PageHeader
          title="Access Control"
          description="Manage verified profiles, Student Branch privileges, and event-scoped responsibilities."
          actions={
            <Link className={buttonClasses()} href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Overview
            </Link>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="size-4 text-primary" aria-hidden="true" />
              Profile Directory
            </CardTitle>
            <CardDescription>
              The configured Admin account is the only source of branch and event role changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AccessControlPanel initialUsers={users} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
