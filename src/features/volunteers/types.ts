export type VolunteerProfileDetails = {
  $id: string;
  userId: string;
  headline?: string;
  bio?: string;
  skills?: string;
  linkedinUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type VolunteerProfileSummary = {
  userId: string;
  name?: string;
  googleEmail: string;
  uomEmail?: string;
  uomVerified: boolean;
  sbRoles: string[];
  eventRoles: Array<{
    eventId: string;
    eventTitle: string;
    role: string;
    committeeName?: string;
  }>;
  details: VolunteerProfileDetails | null;
};
