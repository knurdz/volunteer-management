import "server-only";

import { requireAuth } from "@/features/access-control/server/current-user";
import { canListFormConnections, canManageFormConnections } from "@/features/forms/server/permissions";
import {
  createAppwriteFormConnectionRepository,
  type FormConnectionRepository,
} from "@/features/forms/server/form-connection-repository";
import { createFormConnectionSchema } from "@/features/forms/validation";
import type { CreateFormConnectionInput } from "@/features/forms/types";
import type { SessionUser } from "@/features/access-control/types";

type FormConnectionServiceDeps = {
  now?: () => Date;
  repository: FormConnectionRepository;
};

export function createFormConnectionService({
  now = () => new Date(),
  repository,
}: FormConnectionServiceDeps) {
  return {
    async createFormConnection({
      input,
      user,
    }: {
      input: CreateFormConnectionInput;
      user: SessionUser;
    }) {
      const body = createFormConnectionSchema.parse(input);

      if (!canManageFormConnections(user, body.eventId)) {
        throw new Error("Event form connection permission is required.");
      }

      const timestamp = now().toISOString();

      return repository.create({
        ...body,
        createdAt: timestamp,
        createdBy: user.authUser.id,
        updatedAt: timestamp,
      });
    },

    async listFormConnections({
      eventId,
      user,
    }: {
      eventId?: string;
      user: SessionUser;
    }) {
      if (!canListFormConnections(user, eventId)) {
        throw new Error("Event form connection access is required.");
      }

      return repository.list({ eventId });
    },
  };
}

export function createAppwriteFormConnectionService() {
  return createFormConnectionService({
    repository: createAppwriteFormConnectionRepository(),
  });
}

export async function createFormConnectionForCurrentUser(input: CreateFormConnectionInput) {
  const user = await requireAuth();

  return createAppwriteFormConnectionService().createFormConnection({
    input,
    user,
  });
}

export async function listFormConnectionsForCurrentUser(eventId?: string) {
  const user = await requireAuth();

  return createAppwriteFormConnectionService().listFormConnections({
    eventId,
    user,
  });
}
