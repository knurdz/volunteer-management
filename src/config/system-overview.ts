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
    title: "Volunteer Records",
    description: "Profiles, academic details, skills, and verified experience.",
    icon: Users,
  },
  {
    title: "Event Operations",
    description: "Lifecycle control, committees, applications, and reporting.",
    icon: CalendarDays,
  },
  {
    title: "Application Forms",
    description: "Internal forms with Google Forms fallback where needed.",
    icon: ClipboardList,
  },
  {
    title: "Recognition",
    description: "Grading, points, monthly rankings, and term hall of fame.",
    icon: Award,
  },
  {
    title: "Governance",
    description: "RBAC, approvals, overrides, disputes, and audit trails.",
    icon: ShieldCheck,
  },
  {
    title: "Notifications",
    description: "In-app alerts with an email provider adapter.",
    icon: Bell,
  },
  {
    title: "Exports",
    description: "PDF outputs for volunteer profiles and conclusion reports.",
    icon: FileText,
  },
] as const;

export const foundationItems = [
  "Formal admin interface baseline",
  "Shared design tokens",
  "Reusable UI primitives",
  "Appwrite integration boundary",
  "Documentation for build patterns",
] as const;
