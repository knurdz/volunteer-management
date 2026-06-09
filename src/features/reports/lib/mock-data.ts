import { ROLE_BASE_POINTS } from "@/lib/config";
import type {
  ConclusionReport,
  HallOfFameEntry,
  MockEvent,
  PointsLedger,
  ReportApproval,
  VolunteerOfTheMonth,
  VolunteerProfileExport,
} from "@/features/reports/types";

export const MOCK_EVENTS: MockEvent[] = [
  {
    eventId: "MoraForesight 4.0",
    eventTitle: "MoraForesight 4.0",
    status: "PENDING_CONCLUSION",
    heldOn: "2026-03-15",
    summary:
      "Annual foresight conference with technical sessions, industry panels, and student showcases.",
  },
  {
    eventId: "IEEE Day 2025",
    eventTitle: "IEEE Day 2025",
    status: "CLOSED",
    heldOn: "2025-10-07",
    summary:
      "Branch-wide celebration highlighting IEEE membership, outreach booths, and volunteer recognition.",
  },
  {
    eventId: "CodeSprint 2025",
    eventTitle: "CodeSprint 2025",
    status: "CLOSED",
    heldOn: "2025-08-22",
    summary: "Inter-university coding competition with mentorship clinics and judging panels.",
  },
];

export const MOCK_VOLUNTEER_PROFILES: VolunteerProfileExport[] = [
  {
    userId: "user-amelia",
    name: "Amelia Perera",
    googleEmail: "amelia.perera@gmail.com",
    uomEmail: "amelia.perera@uom.lk",
    sbRoles: ["SB Lead"],
    participations: [
      {
        eventId: "MoraForesight 4.0",
        eventTitle: "MoraForesight 4.0",
        role: "Chair",
        assignedAt: "2025-11-01T00:00:00.000Z",
      },
      {
        eventId: "IEEE Day 2025",
        eventTitle: "IEEE Day 2025",
        role: "Vice Chair",
        assignedAt: "2025-07-10T00:00:00.000Z",
      },
    ],
    recommendations: [
      {
        $id: "rec-1",
        fromName: "Admin",
        eventTitle: "MoraForesight 4.0",
        note: "Led planning with clear documentation and reliable follow-through.",
        createdAt: "2026-03-20T00:00:00.000Z",
      },
    ],
    pointsLedger: {
      total: ROLE_BASE_POINTS.Chair + ROLE_BASE_POINTS["Vice Chair"],
      entries: [
        {
          $id: "pts-1",
          eventId: "MoraForesight 4.0",
          eventTitle: "MoraForesight 4.0",
          role: "Chair",
          points: ROLE_BASE_POINTS.Chair,
          awardedAt: "2026-03-20T00:00:00.000Z",
        },
        {
          $id: "pts-2",
          eventId: "IEEE Day 2025",
          eventTitle: "IEEE Day 2025",
          role: "Vice Chair",
          points: ROLE_BASE_POINTS["Vice Chair"],
          awardedAt: "2025-10-10T00:00:00.000Z",
        },
      ],
    },
  },
  {
    userId: "user-dilan",
    name: "Dilan Fernando",
    googleEmail: "dilan.fernando@gmail.com",
    uomEmail: "dilan.fernando@uom.lk",
    sbRoles: ["SB Member"],
    participations: [
      {
        eventId: "MoraForesight 4.0",
        eventTitle: "MoraForesight 4.0",
        role: "Committee Lead",
        committeeName: "Program",
        assignedAt: "2025-11-15T00:00:00.000Z",
      },
      {
        eventId: "CodeSprint 2025",
        eventTitle: "CodeSprint 2025",
        role: "Committee Member",
        committeeName: "Logistics",
        assignedAt: "2025-06-01T00:00:00.000Z",
      },
    ],
    recommendations: [
      {
        $id: "rec-2",
        fromName: "Amelia Perera",
        eventTitle: "MoraForesight 4.0",
        note: "Coordinated session schedules under tight deadlines.",
        createdAt: "2026-03-18T00:00:00.000Z",
      },
    ],
    pointsLedger: {
      total: ROLE_BASE_POINTS["Committee Lead"] + ROLE_BASE_POINTS["Committee Member"],
      entries: [
        {
          $id: "pts-3",
          eventId: "MoraForesight 4.0",
          eventTitle: "MoraForesight 4.0",
          role: "Committee Lead",
          points: ROLE_BASE_POINTS["Committee Lead"],
          awardedAt: "2026-03-18T00:00:00.000Z",
        },
        {
          $id: "pts-4",
          eventId: "CodeSprint 2025",
          eventTitle: "CodeSprint 2025",
          role: "Committee Member",
          points: ROLE_BASE_POINTS["Committee Member"],
          awardedAt: "2025-08-25T00:00:00.000Z",
        },
      ],
    },
  },
  {
    userId: "user-nadia",
    name: "Nadia Silva",
    googleEmail: "nadia.silva@gmail.com",
    uomEmail: "nadia.silva@uom.lk",
    sbRoles: [],
    participations: [
      {
        eventId: "IEEE Day 2025",
        eventTitle: "IEEE Day 2025",
        role: "Committee Member",
        committeeName: "Outreach",
        assignedAt: "2025-07-20T00:00:00.000Z",
      },
    ],
    recommendations: [],
  },
];

export const MOCK_CONCLUSION_REPORTS: ConclusionReport[] = [
  {
    $id: "report-ieee-day",
    eventId: "IEEE Day 2025",
    eventTitle: "IEEE Day 2025",
    status: "APPROVED",
    content: {
      objectives:
        "Celebrate IEEE Day with outreach activities and recognize active volunteers.",
      outcomes:
        "Hosted three outreach booths and welcomed 180 attendees across sessions.",
      challenges: "Rain required moving one outdoor booth indoors on short notice.",
      recommendations: "Reserve indoor backup space earlier for future outreach events.",
      attendanceNotes: "Peak attendance during the evening membership drive.",
    },
    submittedBy: "user-amelia",
    submittedByName: "Amelia Perera",
    submittedAt: "2025-10-12T00:00:00.000Z",
    createdAt: "2025-10-08T00:00:00.000Z",
    updatedAt: "2025-10-14T00:00:00.000Z",
  },
  {
    $id: "report-codesprint",
    eventId: "CodeSprint 2025",
    eventTitle: "CodeSprint 2025",
    status: "SUBMITTED",
    content: {
      objectives: "Run a fair coding competition with mentorship support.",
      outcomes: "Twelve teams competed and three industry mentors supported judging.",
      challenges: "Network instability affected one practice lab session.",
      recommendations: "Pre-stage a dedicated offline judging environment.",
      attendanceNotes: "Final presentations ran on schedule.",
    },
    submittedBy: "user-dilan",
    submittedByName: "Dilan Fernando",
    submittedAt: "2025-08-26T00:00:00.000Z",
    createdAt: "2025-08-23T00:00:00.000Z",
    updatedAt: "2025-08-26T00:00:00.000Z",
  },
  {
    $id: "report-foresight-draft",
    eventId: "MoraForesight 4.0",
    eventTitle: "MoraForesight 4.0",
    status: "DRAFT",
    content: {
      objectives: "",
      outcomes: "",
      challenges: "",
      recommendations: "",
      attendanceNotes: "",
    },
    submittedBy: "user-amelia",
    submittedByName: "Amelia Perera",
    createdAt: "2026-03-21T00:00:00.000Z",
    updatedAt: "2026-03-21T00:00:00.000Z",
  },
];

export const MOCK_REPORT_APPROVALS: ReportApproval[] = [
  {
    $id: "approval-ieee-day",
    reportId: "report-ieee-day",
    status: "APPROVED",
    reviewedBy: "admin",
    reviewedByName: "System Admin",
    reviewNote: "Clear outcomes and actionable recommendations.",
    reviewedAt: "2025-10-14T00:00:00.000Z",
  },
];

export const MOCK_VOLUNTEER_OF_THE_MONTH: VolunteerOfTheMonth = {
  month: "March",
  year: 2026,
  userId: "user-amelia",
  name: "Amelia Perera",
  pointsEarned: ROLE_BASE_POINTS.Chair,
  highlight: "Led MoraForesight 4.0 planning through conclusion reporting.",
};

export const MOCK_HALL_OF_FAME: HallOfFameEntry[] = [
  {
    rank: 1,
    userId: "user-amelia",
    name: "Amelia Perera",
    pointsEarned: 100,
    term: { label: "2025/2026", startYear: 2025, endYear: 2026 },
  },
  {
    rank: 2,
    userId: "user-dilan",
    name: "Dilan Fernando",
    pointsEarned: 35,
    term: { label: "2025/2026", startYear: 2025, endYear: 2026 },
  },
];

export function getMockPointsLedger(userId: string): PointsLedger | undefined {
  return MOCK_VOLUNTEER_PROFILES.find((profile) => profile.userId === userId)
    ?.pointsLedger;
}
