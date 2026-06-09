import { createHash } from "node:crypto";

export function recommendationRequestKey(requesterId: string, respondentId: string) {
  return `rk_${createHash("sha1").update(`${requesterId}:${respondentId}`).digest("hex")}`;
}

export function recommendationRowId(requestId: string) {
  return `rec_${createHash("sha1").update(requestId).digest("hex").slice(0, 29)}`;
}
