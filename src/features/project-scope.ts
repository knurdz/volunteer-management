import {
  Award,
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";

export const systemModules = [
  {
    title: "Volunteer Management",
    description: "Profiles, skill tags, verified experience, and term roles.",
    icon: Users,
  },
  {
    title: "Event Management",
    description: "Lifecycle control, committees, applications, and reports.",
    icon: CalendarDays,
  },
  {
    title: "Form Builder",
    description: "Internal applications plus Google Form fallback per event.",
    icon: ClipboardList,
  },
  {
    title: "Rewards",
    description: "Hierarchical grading, approval, points, and leaderboards.",
    icon: Award,
  },
  {
    title: "Governance",
    description: "Disputes, overrides, audit logs, and RBAC enforcement.",
    icon: ShieldCheck,
  },
  {
    title: "Notifications",
    description: "In-app alerts with KNURDZ email adapter support.",
    icon: Bell,
  },
  {
    title: "Exports",
    description: "On-demand PDFs for profiles and conclusion reports.",
    icon: FileText,
  },
] as const;
