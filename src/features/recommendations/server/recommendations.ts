import "server-only";

import { Query, type Models } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { isAppwriteConflict, isAppwriteNotFound } from "@/server/errors";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getProfile } from "@/features/access-control/server/profiles";
import {
  assertCanRequestRecommendation,
  assertCanReportRecommendation,
  assertCanRespondToRecommendation,
  shouldRecoverAcceptedRequest,
} from "@/features/recommendations/lib/rules";
import {
  recommendationRequestKey,
  recommendationRequestRowId,
  recommendationRowId,
} from "@/features/recommendations/lib/ids";
import type { Profile } from "@/features/access-control/types";
import type { SessionUser } from "@/features/access-control/types";
import type {
  Recommendation,
  RecommendationProfileIdentity,
  RecommendationRequest,
  RecommendationRequestWithProfiles,
  RecommendationRequestStatus,
  RecommendationVisibilityStatus,
  RecommendationWithProfiles,
  RecommendationWithRespondent,
} from "@/features/recommendations/types";

type AppRow = Models.Row & Record<string, unknown>;

function toRecommendationRequest(row: AppRow): RecommendationRequest {
  return {
    $id: row.$id,
    createdAt: String(row.createdAt),
    message: typeof row.message === "string" && row.message ? row.message : undefined,
    requestKey: typeof row.requestKey === "string" ? row.requestKey : "",
    requesterId: String(row.requesterId),
    respondentId: String(row.respondentId),
    respondedAt:
      typeof row.respondedAt === "string" && row.respondedAt ? row.respondedAt : undefined,
    status: String(row.status) as RecommendationRequestStatus,
  };
}

function toRecommendation(row: AppRow): Recommendation {
  return {
    $id: row.$id,
    createdAt: String(row.createdAt),
    hiddenAt: typeof row.hiddenAt === "string" && row.hiddenAt ? row.hiddenAt : undefined,
    hiddenBy: typeof row.hiddenBy === "string" && row.hiddenBy ? row.hiddenBy : undefined,
    hideReason:
      typeof row.hideReason === "string" && row.hideReason ? row.hideReason : undefined,
    reportedAt:
      typeof row.reportedAt === "string" && row.reportedAt ? row.reportedAt : undefined,
    reportedBy:
      typeof row.reportedBy === "string" && row.reportedBy ? row.reportedBy : undefined,
    reportReason:
      typeof row.reportReason === "string" && row.reportReason ? row.reportReason : undefined,
    requestId: String(row.requestId),
    requesterId: String(row.requesterId),
    respondentId: String(row.respondentId),
    status: String(row.status) as RecommendationVisibilityStatus,
    text: String(row.text),
    updatedAt: String(row.updatedAt),
  };
}

function toRecommendationProfileIdentity(
  profile: Profile | null,
  { includePrivate = false }: { includePrivate?: boolean } = {},
): RecommendationProfileIdentity | null {
  if (!profile) {
    return null;
  }

  return {
    googleEmail: includePrivate ? profile.googleEmail : undefined,
    name: profile.name,
    uomEmail: includePrivate ? profile.uomEmail : undefined,
    userId: profile.authUserId,
  };
}

async function withRecommendationProfiles(
  request: RecommendationRequest,
): Promise<RecommendationRequestWithProfiles> {
  const [requester, respondent] = await Promise.all([
    getProfile(request.requesterId),
    getProfile(request.respondentId),
  ]);

  return {
    ...request,
    requester: toRecommendationProfileIdentity(requester, { includePrivate: true }),
    respondent: toRecommendationProfileIdentity(respondent, { includePrivate: true }),
  };
}

async function getRecommendationForRequest(requestId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.recommendations,
    [Query.equal("requestId", requestId), Query.limit(1)],
    undefined,
    false,
  );

  return result.rows[0] ? toRecommendation(result.rows[0] as AppRow) : null;
}

export async function requestRecommendation({
  message,
  respondentId,
  user,
}: {
  message?: string;
  respondentId: string;
  user: SessionUser;
}) {
  const respondentProfile = await getProfile(respondentId);

  assertCanRequestRecommendation({
    requesterCanVolunteer: canVolunteer(user.profile),
    requesterId: user.authUser.id,
    respondentCanVolunteer: respondentProfile ? canVolunteer(respondentProfile) : false,
    respondentExists: Boolean(respondentProfile),
    respondentId,
  });

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();
  const requestKey = recommendationRequestKey(user.authUser.id, respondentId);
  const existingPending = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.recommendationRequests,
    [
      Query.equal("requestKey", requestKey),
      Query.equal("status", "PENDING"),
      Query.limit(1),
    ],
    undefined,
    false,
  );

  if (existingPending.rows.length > 0) {
    throw new Error("A pending recommendation request already exists for this volunteer.");
  }

  let row: AppRow;
  try {
    row = await tables.createRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.recommendationRequests,
      recommendationRequestRowId(user.authUser.id, respondentId),
      {
        createdAt: now,
        message: message ?? "",
        requesterId: user.authUser.id,
        requestKey,
        respondentId,
        status: "PENDING",
      },
    );
  } catch (error) {
    if (isAppwriteConflict(error)) {
      throw new Error("A recommendation request already exists for this volunteer.");
    }

    throw error;
  }

  await writeAuditLog({
    action: "RECOMMENDATION_REQUESTED",
    actorUserId: user.authUser.id,
    metadata: { respondentId },
    targetId: row.$id,
    targetType: "recommendation_request",
  });

  return toRecommendationRequest(row as AppRow);
}

export async function respondToRecommendationRequest({
  requestId,
  response,
  text,
  user,
}: {
  requestId: string;
  response: "ACCEPTED" | "REJECTED";
  text?: string;
  user: SessionUser;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const requestRow = await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.recommendationRequests,
    requestId,
  );
  const recommendationRequest = toRecommendationRequest(requestRow as AppRow);

  if (
    recommendationRequest.status === "ACCEPTED" &&
    response === "ACCEPTED" &&
    recommendationRequest.respondentId === user.authUser.id
  ) {
    return {
      recommendation: await getRecommendationForRequest(requestId),
      request: recommendationRequest,
    };
  }

  assertCanRespondToRecommendation({
    requestRespondentId: recommendationRequest.respondentId,
    requestStatus: recommendationRequest.status,
    userId: user.authUser.id,
  });

  if (response === "ACCEPTED" && !text?.trim()) {
    throw new Error("Recommendation text is required when accepting a request.");
  }

  const now = new Date().toISOString();
  let recommendation: Recommendation | null = null;

  if (response === "ACCEPTED") {
    recommendation = await getRecommendationForRequest(requestId);

    if (
      shouldRecoverAcceptedRequest({
        existingRecommendation: Boolean(recommendation),
        requestStatus: recommendationRequest.status,
        response,
      })
    ) {
      const recoveredRequestRow = await tables.updateRow(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.recommendationRequests,
        requestId,
        {
          respondedAt: now,
          status: "ACCEPTED",
        },
      );

      await writeAuditLog({
        action: "RECOMMENDATION_ACCEPTED",
        actorUserId: user.authUser.id,
        metadata: { recovered: true, response },
        targetId: requestId,
        targetType: "recommendation_request",
      });

      return {
        recommendation,
        request: toRecommendationRequest(recoveredRequestRow as AppRow),
      };
    }

    try {
      if (!recommendation) {
        const recommendationRow = await tables.createRow<AppRow>(
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          APPWRITE_TABLES.recommendations,
          recommendationRowId(requestId),
          {
            createdAt: now,
            requestId,
            requesterId: recommendationRequest.requesterId,
            respondentId: recommendationRequest.respondentId,
            status: "VISIBLE",
            text: text?.trim() ?? "",
            updatedAt: now,
          },
        );

        recommendation = toRecommendation(recommendationRow);
      }
    } catch (error) {
      if (!isAppwriteConflict(error)) {
        throw error;
      }

      recommendation = await getRecommendationForRequest(requestId);
    }
  }

  const updatedRequestRow = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.recommendationRequests,
    requestId,
    {
      respondedAt: now,
      status: response,
    },
  );

  await writeAuditLog({
    action: response === "ACCEPTED" ? "RECOMMENDATION_ACCEPTED" : "RECOMMENDATION_REJECTED",
    actorUserId: user.authUser.id,
    metadata: { response },
    targetId: requestId,
    targetType: "recommendation_request",
  });

  return {
    recommendation,
    request: toRecommendationRequest(updatedRequestRow as AppRow),
  };
}

export async function hideRecommendation({
  actorUserId,
  reason,
  recommendationId,
}: {
  actorUserId: string;
  reason?: string;
  recommendationId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();
  const row = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.recommendations,
    recommendationId,
    {
      hiddenAt: now,
      hiddenBy: actorUserId,
      hideReason: reason ?? "",
      status: "HIDDEN",
      updatedAt: now,
    },
  );

  await writeAuditLog({
    action: "RECOMMENDATION_HIDDEN",
    actorUserId,
    metadata: { reason },
    targetId: recommendationId,
    targetType: "recommendation",
  });

  return toRecommendation(row as AppRow);
}

export async function reportRecommendation({
  actorUserId,
  reason,
  recommendationId,
}: {
  actorUserId: string;
  reason?: string;
  recommendationId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const existingRow = await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.recommendations,
    recommendationId,
  );
  const existingRecommendation = toRecommendation(existingRow as AppRow);

  assertCanReportRecommendation({ status: existingRecommendation.status });

  const now = new Date().toISOString();
  const row = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.recommendations,
    recommendationId,
    {
      reportReason: reason ?? "",
      reportedAt: now,
      reportedBy: actorUserId,
      status: "REPORTED",
      updatedAt: now,
    },
  );

  await writeAuditLog({
    action: "RECOMMENDATION_REPORTED",
    actorUserId,
    metadata: { reason },
    targetId: recommendationId,
    targetType: "recommendation",
  });

  return toRecommendation(row as AppRow);
}

export async function listVisibleRecommendationsForVolunteer(
  userId: string,
): Promise<RecommendationWithRespondent[]> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.recommendations,
    [
      Query.equal("requesterId", userId),
      Query.equal("status", "VISIBLE"),
      Query.orderDesc("createdAt"),
      Query.limit(100),
    ],
    undefined,
    false,
  );

  const recommendations = result.rows.map((row) => toRecommendation(row as AppRow));

  return Promise.all(
    recommendations.map(async (recommendation) => ({
      ...recommendation,
      respondent: toRecommendationProfileIdentity(await getProfile(recommendation.respondentId)),
    })),
  );
}

export async function listReportedRecommendations(): Promise<RecommendationWithProfiles[]> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.recommendations,
    [Query.equal("status", "REPORTED"), Query.orderDesc("reportedAt"), Query.limit(100)],
    undefined,
    false,
  );
  const recommendations = result.rows.map((row) => toRecommendation(row as AppRow));

  return Promise.all(
    recommendations.map(async (recommendation) => {
      const [requester, respondent] = await Promise.all([
        getProfile(recommendation.requesterId),
        getProfile(recommendation.respondentId),
      ]);

      return {
        ...recommendation,
        requester: toRecommendationProfileIdentity(requester, { includePrivate: true }),
        respondent: toRecommendationProfileIdentity(respondent, { includePrivate: true }),
      };
    }),
  );
}

export async function getRecommendationRequest(requestId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  try {
    const row = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.recommendationRequests,
      requestId,
    );

    return toRecommendationRequest(row as AppRow);
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function listRecommendationRequestsForVolunteer(userId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const [incomingResult, outgoingResult] = await Promise.all([
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.recommendationRequests,
      [
        Query.equal("respondentId", userId),
        Query.orderDesc("createdAt"),
        Query.limit(100),
      ],
      undefined,
      false,
    ),
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.recommendationRequests,
      [
        Query.equal("requesterId", userId),
        Query.orderDesc("createdAt"),
        Query.limit(100),
      ],
      undefined,
      false,
    ),
  ]);

  const incoming = await Promise.all(
    incomingResult.rows
      .map((row) => toRecommendationRequest(row as AppRow))
      .map(withRecommendationProfiles),
  );
  const outgoing = await Promise.all(
    outgoingResult.rows
      .map((row) => toRecommendationRequest(row as AppRow))
      .map(withRecommendationProfiles),
  );

  return {
    incoming,
    outgoing,
  };
}
