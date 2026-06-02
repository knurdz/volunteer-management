import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
