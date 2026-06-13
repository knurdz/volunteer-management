"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { EventRoleAssignment } from "@/features/access-control/types";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatEventDate,
  formatEventStatus,
  getEventStatusBadgeClassName,
  getEventStatusBadgeTone,
} from "@/features/events/lib/event-ui";
import type { Event } from "@/features/events/types";

type UserEvent = {
  event: Event;
  role: EventRoleAssignment;
};

function formatRoleLabel(role: EventRoleAssignment) {
  if (role.role === "Chair" && (role.eventChairCount ?? 0) > 1) {
    return "Co-chair";
  }

  return role.role;
}

export function MyEvents({
  events,
}: Readonly<{
  events: UserEvent[];
}>) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Events"
        description="Events where you hold an active committee responsibility."
      />

      {events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CalendarDays className="size-8 text-text-muted" aria-hidden="true" />
            <p className="text-sm text-text-secondary">
              You are not assigned to any events at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map(({ event, role }) => (
            <Link href={`/events/${event.$id}`} key={event.$id}>
              <Card className="h-full transition-colors hover:border-primary/30 hover:bg-surface-subtle">
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text-primary">{event.title}</h3>
                      <p className="mt-1 text-xs text-text-muted">{event.reference}</p>
                    </div>
                    <Badge tone="primary">{formatRoleLabel(role)}</Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={getEventStatusBadgeClassName(event.status)}
                      tone={getEventStatusBadgeTone(event.status)}
                    >
                      {formatEventStatus(event.status)}
                    </Badge>
                    {role.committeeName ? <Badge>{role.committeeName}</Badge> : null}
                  </div>

                  <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-secondary">Term / Year</dt>
                      <dd className="font-medium text-text-primary">
                        {event.term} · {event.year}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-secondary">Start date</dt>
                      <dd className="font-medium text-text-primary">
                        {formatEventDate(event.start_date)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
