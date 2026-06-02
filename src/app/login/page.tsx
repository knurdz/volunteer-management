import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, LogIn, ShieldCheck } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { getLoginErrorMessage } from "@/features/access-control/lib/login-error";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";
import { getCurrentUser } from "@/features/access-control/server/current-user";

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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-5xl">
        <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card lg:grid-cols-[1fr_420px]">
          <section className="flex min-h-[420px] flex-col justify-between border-b border-border bg-surface-subtle p-6 lg:border-b-0 lg:border-r lg:p-8">
            <div>
              <div className="flex size-11 items-center justify-center rounded-md border border-primary/20 bg-primary-soft text-primary">
                <ShieldCheck className="size-6" aria-hidden="true" />
              </div>
              <p className="mt-6 text-sm font-semibold uppercase tracking-normal text-text-muted">
                {ORGANIZATION_NAME}
              </p>
              <h1 className="mt-2 max-w-xl text-3xl font-semibold text-text-primary">
                {APP_NAME}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary">
                Secure access for account verification and Student Branch role
                administration.
              </p>
            </div>
            <div className="mt-8 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
              <div className="rounded-md border border-border bg-surface px-4 py-3">
                <Building2 className="mb-2 size-4 text-primary" aria-hidden="true" />
                Google account sign-in
              </div>
              <div className="rounded-md border border-border bg-surface px-4 py-3">
                <ShieldCheck className="mb-2 size-4 text-primary" aria-hidden="true" />
                UoM email verification
              </div>
            </div>
          </section>

          <section className="flex items-center p-6 lg:p-8">
            <div className="w-full">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Sign in</h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  Continue with the Google account used for this system.
                </p>
              </div>
              <div className="mt-5 space-y-4">
                {errorMessage ? (
                  <div className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
                    <p className="font-semibold">{errorMessage.title}</p>
                    {errorMessage.details ? (
                      <p className="mt-1 leading-5">{errorMessage.details}</p>
                    ) : null}
                  </div>
                ) : null}
                <Link
                  className={buttonClasses({
                    className: "w-full",
                    variant: "primary",
                  })}
                  href="/api/auth/google"
                >
                  <LogIn className="size-4" aria-hidden="true" />
                  Continue with Google
                </Link>
                <p className="text-xs leading-5 text-text-muted">
                  Volunteer actions require a verified{" "}
                  <span className="font-medium">@uom.lk</span> email after sign-in.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
