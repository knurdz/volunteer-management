export type RecommendationRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type RecommendationVisibilityStatus = "VISIBLE" | "HIDDEN" | "REPORTED";

export type RecommendationRequest = {
  $id: string;
  requesterId: string;
  respondentId: string;
  message?: string;
  status: RecommendationRequestStatus;
  createdAt: string;
  respondedAt?: string;
};

export type Recommendation = {
  $id: string;
  requestId: string;
  requesterId: string;
  respondentId: string;
  text: string;
  status: RecommendationVisibilityStatus;
  createdAt: string;
  updatedAt: string;
  hiddenAt?: string;
  hiddenBy?: string;
  reportedAt?: string;
  reportedBy?: string;
  reportReason?: string;
};

export type RecommendationProfileIdentity = {
  userId: string;
  name?: string;
  googleEmail: string;
  uomEmail?: string;
};

export type RecommendationWithRespondent = Recommendation & {
  respondent: RecommendationProfileIdentity | null;
};

export type RecommendationRequestWithProfiles = RecommendationRequest & {
  requester: RecommendationProfileIdentity | null;
  respondent: RecommendationProfileIdentity | null;
};
