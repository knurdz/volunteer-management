"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatConclusionStatus,
  formatEventDate,
  formatEventStatus,
  getConclusionStatusBadgeTone,
  getEventStatusBadgeClassName,
  getEventStatusBadgeTone,
} from "@/features/events/lib/event-ui";
import type { Event } from "@/features/events/types";

export function EventList({
  canCreate,
}: Readonly<{
  canCreate: boolean;
}>) {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/events");
        const payload = await response.json();

        if (!response.ok) {
          if (!cancelled) {
            setError(payload.error ?? "Could not load events.");
          }
          return;
        }

        if (!cancelled) {
          setEvents(payload.events ?? []);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load events.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Branch events and their lifecycle status."
        actions={
          canCreate ? (
            <Link className={buttonClasses({ variant: "primary" })} href="/events/new">
              <Plus className="size-4" aria-hidden="true" />
              Create Event
            </Link>
          ) : null
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading events...
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!loading && !error && events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CalendarDays className="size-8 text-text-muted" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No events are available to display.</p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error && events.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <Link href={`/events/${event.$id}`} key={event.$id}>
              <Card className="h-full transition-colors hover:border-primary/30 hover:bg-surface-subtle">
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text-primary">{event.title}</h3>
                      <p className="mt-1 text-xs text-text-muted">{event.reference}</p>
                    </div>
                    <Badge
                      className={getEventStatusBadgeClassName(event.status)}
                      tone={getEventStatusBadgeTone(event.status)}
                    >
                      {formatEventStatus(event.status)}
                    </Badge>
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
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-text-secondary">Conclusion</dt>
                      <dd>
                        <Badge tone={getConclusionStatusBadgeTone(event.conclusion_status)}>
                          {formatConclusionStatus(event.conclusion_status)}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
