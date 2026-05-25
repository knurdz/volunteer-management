import { ArrowRight, CheckCircle2, LockKeyhole, Sparkles } from "lucide-react";
import { systemModules } from "@/features/project-scope";
import {
  APP_NAME,
  EVENT_ROLES,
  EVENT_STATUSES,
  ORGANIZATION_NAME,
} from "@/lib/config";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#172033]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <nav className="flex flex-col gap-4 border-b border-[#d7dde8] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#596477]">
              {ORGANIZATION_NAME}
            </p>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              {APP_NAME}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-medium text-[#344054]">
              <LockKeyhole className="size-4" />
              @uom.lk only
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-[#a9c4ff] bg-[#eaf1ff] px-3 py-2 text-sm font-medium text-[#184a9c]">
              <Sparkles className="size-4" />
              Appwrite ready
            </span>
          </div>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border border-[#d7dde8] bg-white p-6 shadow-sm sm:p-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-normal text-[#1f6feb]">
                Foundation
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-5xl">
                Full product setup for volunteer, event, and reward operations.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#596477]">
                The repo is prepared as a single Next.js project with Appwrite
                Cloud integration points, strict UoM auth assumptions, and the
                core domain constants from the approved scope.
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Next.js", "TypeScript", "Appwrite"].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-md bg-[#eef2f7] px-3 py-3 text-sm font-medium"
                >
                  <CheckCircle2 className="size-4 text-[#0f7b45]" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#d7dde8] bg-[#172033] p-6 text-white shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold">Workflow Guardrails</h2>
            <div className="mt-5 space-y-5">
              <div>
                <p className="text-sm font-medium text-[#b7c3d7]">
                  Event lifecycle
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EVENT_STATUSES.map((status) => (
                    <span
                      key={status}
                      className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium"
                    >
                      {status}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-[#b7c3d7]">
                  Committee roles
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {EVENT_ROLES.map((role) => (
                    <span
                      key={role}
                      className="rounded-md bg-white px-3 py-2 text-sm font-medium text-[#172033]"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {systemModules.map((module) => {
            const Icon = module.icon;

            return (
              <article
                key={module.title}
                className="rounded-lg border border-[#d7dde8] bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-10 items-center justify-center rounded-md bg-[#eaf1ff] text-[#1f6feb]">
                    <Icon className="size-5" />
                  </div>
                  <ArrowRight className="size-5 text-[#96a2b6]" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#596477]">
                  {module.description}
                </p>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
