import { CheckCircle2 } from "lucide-react";
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
import { foundationItems, systemModules } from "@/config/system-overview";
import {
  EVENT_ROLES,
  EVENT_STATUSES,
  SB_ROLES,
  SCORING_ROLES,
} from "@/lib/config";

export default function Home() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Sprint 0"
          title="Volunteer management foundation"
          description="The repo is aligned to the revised internal volunteer management scope. This page stays minimal so backend features can be tested before final UI polish."
          actions={
            <>
              <Badge tone="primary">Google login</Badge>
              <Badge>@uom.lk verification for volunteers</Badge>
              <Badge>Appwrite Cloud</Badge>
            </>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Baseline Decisions</CardTitle>
              <CardDescription>
                Stable choices to follow before Developer 1 starts feature work.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {foundationItems.map((item) => (
                  <div
                    key={item}
                    className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm font-medium text-text-primary"
                  >
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Domain Guardrails</CardTitle>
              <CardDescription>
                Reference-only constants for the first backend implementation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Student Branch roles
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SB_ROLES.map((role) => (
                    <Badge key={role} tone="primary">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Event lifecycle
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EVENT_STATUSES.map((status) => (
                    <Badge key={status}>{status}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Event roles
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EVENT_ROLES.map((role) => (
                    <Badge key={role} tone="primary">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Scoring basis from SRS
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SCORING_ROLES.map((role) => (
                    <Badge key={role}>{role}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Planned System Areas</CardTitle>
            <CardDescription>
              These are navigation-ready categories, not implemented features.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {systemModules.map((module) => {
                const Icon = module.icon;

                return (
                  <article
                    key={module.title}
                    className="rounded-lg border border-border bg-surface-subtle p-4"
                  >
                    <div className="flex size-10 items-center justify-center rounded-md border border-border bg-surface text-primary">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-text-primary">
                      {module.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      {module.description}
                    </p>
                  </article>
                );
              })}
            </section>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
