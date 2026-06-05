import { NextResponse } from "next/server";
import { volunteerProfileDetailsSchema } from "@/features/volunteers/lib/profile-details";
import { requireUomVerifiedVolunteer } from "@/features/access-control/server/current-user";
import {
  getVolunteerProfileDetails,
  upsertMyVolunteerProfileDetails,
} from "@/features/volunteers/server/profiles";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET() {
  try {
    const user = await requireUomVerifiedVolunteer();
    const details = await getVolunteerProfileDetails(user.authUser.id);

    return NextResponse.json({ details });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Volunteer profile failed.",
      routeErrorStatus(error),
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUomVerifiedVolunteer();
    const detailsInput = volunteerProfileDetailsSchema.parse(await request.json());
    const details = await upsertMyVolunteerProfileDetails({
      details: detailsInput,
      user,
    });

    return NextResponse.json({ details });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Volunteer profile update failed.",
      routeErrorStatus(error),
    );
  }
}
