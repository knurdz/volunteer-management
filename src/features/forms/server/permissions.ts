import "server-only";

import { hasEventRole } from "@/features/access-control/lib/rules";
import type { SessionUser } from "@/features/access-control/types";

const FORM_MANAGER_EVENT_ROLES = ["Chair", "Vice Chair", "Committee Lead"] as const;
const FORM_VIEWER_EVENT_ROLES = [
  "Chair",
  "Vice Chair",
  "Committee Lead",
  "Committee Member",
] as const;

export function canManageFormConnections(user: SessionUser, eventId: string) {
  return user.isAdmin || hasEventRole(user, eventId, [...FORM_MANAGER_EVENT_ROLES]);
}

export function canListFormConnections(user: SessionUser, eventId?: string) {
  if (user.isAdmin) {
    return true;
  }

  if (!eventId) {
    // TODO(Senuka events): replace with the event visibility helper once events expose
    // a canonical "can list event assets for this user" permission.
    return false;
  }

  return hasEventRole(user, eventId, [...FORM_VIEWER_EVENT_ROLES]);
}
