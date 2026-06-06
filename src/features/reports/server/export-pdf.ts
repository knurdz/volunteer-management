"use server";

import { getEventRoleDisplayName } from "@/features/access-control/lib/rules";
import {
  assertConclusionReportExportable,
  getReportApproval,
} from "@/features/reports/server/conclusion-service";
import { assertVolunteerProfileExportable } from "@/features/reports/server/volunteer-profile";
import { buildConclusionReportPdf, buildVolunteerProfilePdf } from "@/pdf";

export async function exportConclusionReportPdfAction(reportId: string) {
  const report = assertConclusionReportExportable(reportId);
  const approval = getReportApproval(reportId);
  const result = await buildConclusionReportPdf({
    approvedAt: approval?.reviewedAt,
    content: report.content,
    eventId: report.eventId,
    eventTitle: report.eventTitle,
    submittedAt: report.submittedAt,
    submittedByName: report.submittedByName,
  });

  return {
    data: result.buffer.toString("base64"),
    filename: result.filename,
  };
}

export async function exportVolunteerProfilePdfAction(userId: string) {
  const profile = assertVolunteerProfileExportable(userId);
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
