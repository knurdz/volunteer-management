import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";
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
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { listAdminUsers } from "@/features/access-control/server/admin-users";
import { SystemSettingsPanel } from "@/features/system-settings/components/system-settings-panel";
import { getInitialSystemSettingsData } from "@/features/system-settings/server/settings";
import { listTopBoardExclusions } from "@/features/system-settings/server/top-board-exclusions";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const [settingsData, users] = await Promise.all([
    getInitialSystemSettingsData(),
    listAdminUsers(),
  ]);
  const selectedTermId = settingsData.activeTermId || settingsData.terms[0]?.$id || "";
  const exclusions = selectedTermId
    ? await listTopBoardExclusions(selectedTermId)
    : [];

  return (
    <AppShell active="settings" user={currentUser}>
      <div className="space-y-6">
        <PageHeader
          title="System Settings"
          description="Manage IEEE terms, active term selection, Top Board exclusions, permission visibility, and audit review."
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
              <Settings className="size-4 text-primary" aria-hidden="true" />
              Core Configuration
            </CardTitle>
            <CardDescription>
              IEEE term dates are Admin-managed because Student Branch transitions are AGM-driven rather than hardcoded to one fixed calendar boundary.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SystemSettingsPanel
              initialActiveTermId={settingsData.activeTermId}
              initialAuditPage={settingsData.auditPage}
              initialExclusions={exclusions}
              initialPermissions={settingsData.permissions}
              initialSelectedTermId={selectedTermId}
              initialTerms={settingsData.terms}
              initialUsers={users}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
