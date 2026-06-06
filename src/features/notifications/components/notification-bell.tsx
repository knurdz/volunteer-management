"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ExternalLink, Inbox, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Notification } from "@/features/notifications/types";

type NotificationBellProps = {
  initialNotifications: Notification[];
  initialUnreadCount: number;
};

type NotificationPayload = {
  notifications: Notification[];
  unreadCount: number;
};

export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState(initialNotifications);
  const [pendingReadIds, setPendingReadIds] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const unreadNotificationIds = useMemo(
    () =>
      notifications
        .filter((notification) => !notification.readAt)
        .map((notification) => notification.id),
    [notifications],
  );

  async function refreshNotifications() {
    setIsRefreshing(true);
    setMessage("");

    try {
      const response = await fetch("/api/notifications?limit=15");
      const payload = (await response.json()) as NotificationPayload & { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Could not refresh notifications.");
        return;
      }

      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function markRead(notificationIds: string[]) {
    if (notificationIds.length === 0) {
      return;
    }

    setPendingReadIds(notificationIds);
    setMessage("");

    try {
      const response = await fetch("/api/notifications/mark-read", {
        body: JSON.stringify({ notificationIds }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        notifications?: Notification[];
      };

      if (!response.ok) {
        setMessage(payload.error ?? "Could not update notifications.");
        return;
      }

      const updatedById = new Map(
        (payload.notifications ?? []).map((notification) => [
          notification.id,
          notification,
        ]),
      );

      setNotifications((current) =>
        current.map((notification) => updatedById.get(notification.id) ?? notification),
      );
      setUnreadCount((current) =>
        Math.max(
          0,
          current -
            notificationIds.filter((id) =>
              notifications.some(
                (notification) => notification.id === id && !notification.readAt,
              ),
            ).length,
        ),
      );
    } finally {
      setPendingReadIds([]);
    }
  }

  function toggleOpen() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      void refreshNotifications();
    }
  }

  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        aria-label="Notifications"
        className="relative inline-flex size-10 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={toggleOpen}
        type="button"
      >
        <Bell className="size-5" aria-hidden="true" />
        <UnreadCountBadge count={unreadCount} />
      </button>

      {isOpen ? (
        <NotificationDropdown
          isRefreshing={isRefreshing}
          message={message}
          notifications={notifications}
          onMarkAllRead={() => markRead(unreadNotificationIds)}
          onMarkRead={(notificationId) => markRead([notificationId])}
          onRefresh={refreshNotifications}
          pendingReadIds={pendingReadIds}
          unreadCount={unreadCount}
        />
      ) : null}
    </div>
  );
}

export function UnreadCountBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full border border-surface bg-danger px-1.5 text-[11px] font-semibold leading-5 text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function NotificationDropdown({
  isRefreshing,
  message,
  notifications,
  onMarkAllRead,
  onMarkRead,
  onRefresh,
  pendingReadIds,
  unreadCount,
}: {
  isRefreshing: boolean;
  message: string;
  notifications: Notification[];
  onMarkAllRead: () => void;
  onMarkRead: (notificationId: string) => void;
  onRefresh: () => Promise<void>;
  pendingReadIds: string[];
  unreadCount: number;
}) {
  return (
    <div className="absolute right-0 z-40 mt-2 w-[min(calc(100vw-2rem),26rem)] overflow-hidden rounded-lg border border-border bg-surface text-text-primary shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-text-secondary">
            {unreadCount} unread
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="h-8 px-2.5 text-xs"
            disabled={unreadCount === 0 || pendingReadIds.length > 0}
            onClick={onMarkAllRead}
            type="button"
            variant="ghost"
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            Mark all
          </Button>
          <button
            aria-label="Refresh notifications"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
            disabled={isRefreshing}
            onClick={() => void onRefresh()}
            type="button"
          >
            {isRefreshing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Inbox className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {message ? (
        <p className="border-b border-danger/20 bg-danger-soft px-4 py-2 text-sm text-danger">
          {message}
        </p>
      ) : null}

      <NotificationList
        notifications={notifications}
        onMarkRead={onMarkRead}
        pendingReadIds={pendingReadIds}
      />
    </div>
  );
}

export function NotificationList({
  notifications,
  onMarkRead,
  pendingReadIds,
}: {
  notifications: Notification[];
  onMarkRead: (notificationId: string) => void;
  pendingReadIds: string[];
}) {
  if (notifications.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-text-secondary">
        <Inbox className="mx-auto mb-2 size-5 text-text-muted" aria-hidden="true" />
        No notifications yet.
      </div>
    );
  }

  return (
    <div className="max-h-[28rem] overflow-y-auto">
      {notifications.map((notification) => (
        <NotificationListItem
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
          pending={pendingReadIds.includes(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationListItem({
  notification,
  onMarkRead,
  pending,
}: {
  notification: Notification;
  onMarkRead: (notificationId: string) => void;
  pending: boolean;
}) {
  const mainContent = (
    <div className={notification.linkHref ? "block" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">
              {notification.title}
            </p>
            <NotificationReadState readAt={notification.readAt} />
          </div>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            {notification.message}
          </p>
        </div>
        {notification.linkHref ? (
          <ExternalLink className="mt-1 size-4 shrink-0 text-text-muted" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  );

  return (
    <div className={notificationItemClasses(!notification.readAt)}>
      {notification.linkHref ? (
        <Link href={notification.linkHref}>{mainContent}</Link>
      ) : (
        mainContent
      )}
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-muted">
        <span>{new Date(notification.createdAt).toLocaleString()}</span>
        {!notification.readAt ? (
          <button
            className="font-medium text-primary hover:text-primary-hover"
            disabled={pending}
            onClick={() => onMarkRead(notification.id)}
            type="button"
          >
            {pending ? "Saving" : "Mark read"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationReadState({ readAt }: { readAt: string | null }) {
  return (
    <Badge
      className="h-6 px-2 text-[11px]"
      tone={readAt ? "neutral" : "primary"}
    >
      {readAt ? "Read" : "Unread"}
    </Badge>
  );
}

function notificationItemClasses(unread: boolean) {
  return cn(
    "border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-muted",
    unread ? "bg-primary-soft/45" : "bg-surface",
  );
}
