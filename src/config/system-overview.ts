import {
  Award,
  Bell,
  CalendarDays,
  ClipboardList,
  ShieldCheck,
  Users,
} from "lucide-react";

export const systemModules = [
  {
    title: "Volunteer Records",
    description: "Profiles, skills, UoM verification, and volunteer history.",
    icon: Users,
  },
  {
    title: "Internal Event Records",
    description: "Event records, event roles, participation, and summaries.",
    icon: CalendarDays,
  },
  {
    title: "External Form Links",
    description: "Integration boundary for the form builder handled separately.",
    icon: ClipboardList,
  },
  {
    title: "Recognition",
    description: "Lifetime points with monthly and yearly best selections.",
    icon: Award,
  },
  {
    title: "Governance",
    description: "Single Admin, assigned privileges, overrides, and audit trails.",
    icon: ShieldCheck,
  },
  {
    title: "Notifications",
    description: "Integration boundary for the external email service.",
    icon: Bell,
  },
] as const;

export const foundationItems = [
  "Internal volunteer management scope",
  "Minimal UI for backend testing first",
  "Single Admin privilege model",
  "External form and email integration boundaries",
  "Lifetime points with period-based recognition",
] as const;
