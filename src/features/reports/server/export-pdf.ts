"use server";

import { getEventRoleDisplayName } from "@/features/access-control/lib/rules";
import { requireAuth } from "@/features/access-control/server/current-user";
import {
  assertConclusionReportExportable,
  canExportConclusionReportPdf,
} from "@/features/reports/server/conclusion-service";
import { getVolunteerProfile } from "@/features/reports/server/volunteer-profile";
import { buildConclusionReportPdf, buildVolunteerProfilePdf } from "@/pdf";

function formatPdfDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

async function assertVolunteerProfileExportable(userId: string) {
  const profile = await getVolunteerProfile(userId);

  if (!profile) {
    throw new Error("Volunteer profile was not found.");
  }

  return profile;
}

function canExportVolunteerProfilePdf(
  user: Awaited<ReturnType<typeof requireAuth>>,
  targetUserId: string,
) {
  return user.isAdmin || user.authUser.id === targetUserId;
}

export async function exportConclusionReportPdfAction(reportId: string) {
  const user = await requireAuth();
  const { approval, report } = await assertConclusionReportExportable(reportId);

  if (!canExportConclusionReportPdf(user, report)) {
    throw new Error("You do not have access to export this report.");
  }

  const result = await buildConclusionReportPdf({
    approvedAt: formatPdfDate(approval.reviewedAt),
    content: report.content,
    eventId: report.eventId,
    eventTitle: report.eventTitle,
    submittedAt: formatPdfDate(report.submittedAt),
    submittedByName: report.submittedByName,
  });

  return {
    data: result.buffer.toString("base64"),
    filename: result.filename,
  };
}

export async function exportVolunteerProfilePdfAction(userId: string) {
  const user = await requireAuth();
  const profile = await assertVolunteerProfileExportable(userId);

  if (!canExportVolunteerProfilePdf(user, userId)) {
    throw new Error("You do not have access to export this volunteer profile.");
  }

  const result = await buildVolunteerProfilePdf({
    googleEmail: profile.googleEmail,
    name: profile.name,
    participations: profile.participations.map((participation) => ({
      assignedAt: participation.assignedAt,
      committeeName: participation.committeeName,
      eventTitle: participation.eventTitle,
      role: getEventRoleDisplayName(participation.role),
    })),
    pointsLedger: profile.pointsLedger
      ? {
          entries: profile.pointsLedger.entries.map((entry) => ({
            awardedAt: entry.awardedAt,
            eventTitle: entry.eventTitle,
            points: entry.points,
            role: getEventRoleDisplayName(entry.role),
          })),
          total: profile.pointsLedger.total,
        }
      : undefined,
    recommendations: profile.recommendations,
    sbRoles: profile.sbRoles,
    uomEmail: profile.uomEmail,
  });

  return {
    data: result.buffer.toString("base64"),
    filename: result.filename,
  };
}
