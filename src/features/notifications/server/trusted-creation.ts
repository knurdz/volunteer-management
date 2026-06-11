import "server-only";

import { timingSafeEqual } from "node:crypto";

export const INTERNAL_NOTIFICATION_TOKEN_HEADER = "x-internal-job-token";

export type TrustedNotificationCheck =
  | { ok: true }
  | {
      message: string;
      ok: false;
      status: number;
    };

export function checkTrustedNotificationToken({
  configuredToken,
  providedToken,
}: {
  configuredToken?: string;
  providedToken?: string | null;
}): TrustedNotificationCheck {
  if (!configuredToken) {
    return {
      message:
        "Trusted notification creation is disabled until INTERNAL_JOB_TOKEN is configured.",
      ok: false,
      status: 403,
    };
  }

  if (!providedToken || !safeTokenEquals(providedToken, configuredToken)) {
    return {
      message: "Trusted notification creation token is invalid.",
      ok: false,
      status: 403,
    };
  }

  return { ok: true };
}

export function getProvidedTrustedNotificationToken(headers: Headers) {
  const headerToken = headers.get(INTERNAL_NOTIFICATION_TOKEN_HEADER);

  if (headerToken) {
    return headerToken;
  }

  const authorization = headers.get("authorization");
  const bearerPrefix = "Bearer ";

  if (authorization?.startsWith(bearerPrefix)) {
    return authorization.slice(bearerPrefix.length);
  }

  return null;
}

function safeTokenEquals(providedToken: string, configuredToken: string) {
  const provided = Buffer.from(providedToken);
  const configured = Buffer.from(configuredToken);

  if (provided.length !== configured.length) {
    return false;
  }

  return timingSafeEqual(provided, configured);
}
