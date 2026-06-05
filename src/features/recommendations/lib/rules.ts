export function assertCanRequestRecommendation({
  requesterCanVolunteer = true,
  requesterId,
  respondentCanVolunteer = true,
  respondentExists = true,
  respondentId,
}: {
  requesterCanVolunteer?: boolean;
  requesterId: string;
  respondentCanVolunteer?: boolean;
  respondentExists?: boolean;
  respondentId: string;
}) {
  if (!requesterCanVolunteer) {
    throw new Error("Verified UoM email is required before requesting recommendations.");
  }

  if (requesterId === respondentId) {
    throw new Error("A user cannot recommend themselves.");
  }

  if (!respondentExists) {
    throw new Error("Requested volunteer profile was not found.");
  }

  if (!respondentCanVolunteer) {
    throw new Error("Recommendations can only be requested from verified volunteers.");
  }
}

export function assertCanRespondToRecommendation({
  requestStatus,
  requestRespondentId,
  userId,
}: {
  requestStatus: string;
  requestRespondentId: string;
  userId: string;
}) {
  if (requestRespondentId !== userId) {
    throw new Error("Only the requested volunteer can respond.");
  }

  if (requestStatus !== "PENDING") {
    throw new Error("Recommendation request has already been answered.");
  }
}

export function assertCanReportRecommendation({
  status,
}: {
  status: string;
}) {
  if (status !== "VISIBLE") {
    throw new Error("Only visible recommendations can be reported.");
  }
}
