import type { FormConnectionProvider } from "@/features/forms/types";

export const APPROVED_NOTIFICATION_HTTPS_HOSTS = [
  "docs.google.com",
  "forms.gle",
  "forms.google.com",
  "ieee.org",
  "uom.lk",
  "www.ieee.org",
  "www.uom.lk",
] as const;

const APPROVED_FORM_HOSTS: Record<FormConnectionProvider, readonly string[]> = {
  external_form_builder: [
    "airtable.com",
    "form.typeform.com",
    "forms.office.com",
    "jotform.com",
    "tally.so",
    "www.jotform.com",
  ],
  google_forms: ["docs.google.com", "forms.gle", "forms.google.com"],
  other: [],
};

export function isSafeInternalPath(value: string) {
  const trimmed = value.trim();

  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    /[\u0000-\u001F\u007F\\]/.test(trimmed)
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed, "https://internal.volunteer-management.local");
    return parsed.origin === "https://internal.volunteer-management.local";
  } catch {
    return false;
  }
}

export function isApprovedHttpsUrl(
  value: string,
  approvedHosts: readonly string[] = APPROVED_NOTIFICATION_HTTPS_HOSTS,
) {
  const parsed = parseHttpsUrl(value);

  if (!parsed) {
    return false;
  }

  return hostMatches(parsed.hostname, approvedHosts);
}

export function isSafeNotificationLink(value: string) {
  return isSafeInternalPath(value) || isApprovedHttpsUrl(value);
}

export function isProviderApprovedFormUrl(
  value: string,
  provider: FormConnectionProvider,
) {
  const parsed = parseHttpsUrl(value);

  if (!parsed) {
    return false;
  }

  if (provider === "other") {
    return true;
  }

  if (!hostMatches(parsed.hostname, APPROVED_FORM_HOSTS[provider])) {
    return false;
  }

  if (parsed.hostname === "docs.google.com") {
    return parsed.pathname === "/forms" || parsed.pathname.startsWith("/forms/");
  }

  return true;
}

function parseHttpsUrl(value: string) {
  try {
    const parsed = new URL(value.trim());

    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function hostMatches(hostname: string, approvedHosts: readonly string[]) {
  const normalizedHost = normalizeHostname(hostname);

  return approvedHosts.some((approvedHost) => {
    const normalizedApprovedHost = normalizeHostname(approvedHost);
    return (
      normalizedHost === normalizedApprovedHost ||
      normalizedHost.endsWith(`.${normalizedApprovedHost}`)
    );
  });
}

function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}
