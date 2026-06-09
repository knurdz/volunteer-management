export type VolunteerProfileDetails = {
  $id: string;
  userId: string;
  batchYear: string;
  headline?: string;
  bio?: string;
  department: string;
  faculty: string;
  ieeeMembership: string;
  skills?: string;
  linkedinUrl?: string;
  universityIndex: string;
  createdAt: string;
  updatedAt: string;
};

export type VolunteerProfileSummary = {
  userId: string;
  name?: string;
  googleEmail?: string;
  uomEmail?: string;
  sbRoles: string[];
  eventRoles: Array<{
    eventId: string;
    eventTitle: string;
    role: string;
    committeeName?: string;
  }>;
  details: VolunteerProfileDetails | null;
  isPrivateView: boolean;
};
