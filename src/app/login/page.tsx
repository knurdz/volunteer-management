import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLoginErrorMessage } from "@/lib/auth/login-error";
import { getCurrentUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const errorMessage = getLoginErrorMessage(params.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use Google to access the Volunteer Management test area.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? (
            <div className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
              <p className="font-semibold">{errorMessage.title}</p>
              {errorMessage.details ? (
                <p className="mt-1 leading-5">{errorMessage.details}</p>
              ) : null}
            </div>
          ) : null}
          <Link
            className={buttonClasses({ className: "w-full", variant: "primary" })}
            href="/api/auth/google"
          >
            Continue with Google
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
