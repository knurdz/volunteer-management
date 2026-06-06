"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  History,
  RefreshCw,
  ShieldCheck,
  ShieldMinus,
  UserMinus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from "@/features/system-settings/lib/display";
import {
  formatTermLabel,
  getSuggestedTermRange,
  isActiveTopBoardExclusion,
} from "@/features/system-settings/lib/rules";
import type { Profile } from "@/features/access-control/types";
import type {
  AuditLog,
  AuditLogPage,
  IeeeTerm,
  IeeeTermStatus,
  PermissionOverview,
  TopBoardExclusion,
} from "@/features/system-settings/types";

type PanelTab = "audit" | "exclusions" | "permissions" | "terms";
type NoticeStatus = "error" | "idle" | "success";
type TermFormState = {
  endDate: string;
  notes: string;
  startDate: string;
  status: Exclude<IeeeTermStatus, "ACTIVE">;
};
type ExclusionFormState = {
  reason: string;
  userId: string;
};
type AuditFilters = {
  action: string;
  actorUserId: string;
  dateFrom: string;
  dateTo: string;
  targetId: string;
};
type Confirmation =
  | { kind: "activate-term"; term: IeeeTerm }
  | { kind: "close-term"; term: IeeeTerm }
  | { exclusion: TopBoardExclusion; kind: "revoke-exclusion"; userName: string };

const suggestedTerm = getSuggestedTermRange();
const emptyTermForm: TermFormState = {
  endDate: suggestedTerm.endDate,
  notes: "",
  startDate: suggestedTerm.startDate,
  status: "DRAFT",
};
const auditActionOptions = [
  "PROFILE_BOOTSTRAPPED",
  "PROFILE_LOGIN_UPDATED",
  "UOM_VERIFICATION_REQUESTED",
  "UOM_VERIFICATION_CONFIRMED",
  "SB_ROLE_ASSIGNED",
  "SB_ROLE_REVOKED",
  "EVENT_ROLE_ASSIGNED",
  "EVENT_ROLE_REVOKED",
  "IEEE_TERM_CREATED",
  "IEEE_TERM_UPDATED",
  "IEEE_TERM_ACTIVATED",
  "IEEE_TERM_CLOSED",
  "IEEE_TERM_STATE_REPAIRED",
  "TOP_BOARD_EXCLUSION_ADDED",
  "TOP_BOARD_EXCLUSION_REMOVED",
  "SYSTEM_SETTING_UPDATED",
];
const inputClasses =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary";

export function SystemSettingsPanel({
  initialActiveTermId,
  initialAuditPage,
  initialExclusions,
  initialPermissions,
  initialSelectedTermId,
  initialTerms,
  initialUsers,
}: {
  initialActiveTermId: string;
  initialAuditPage: AuditLogPage;
  initialExclusions: TopBoardExclusion[];
  initialPermissions: PermissionOverview;
  initialSelectedTermId: string;
  initialTerms: IeeeTerm[];
  initialUsers: Profile[];
}) {
  const [activeTermId, setActiveTermId] = useState(initialActiveTermId);
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({
    action: "",
    actorUserId: "",
    dateFrom: "",
    dateTo: "",
    targetId: "",
  });
  const [auditLogs, setAuditLogs] = useState(initialAuditPage.auditLogs);
  const [auditNextCursor, setAuditNextCursor] = useState(
    initialAuditPage.nextCursor ?? "",
  );
  const [auditTotal, setAuditTotal] = useState(initialAuditPage.total);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [exclusionForm, setExclusionForm] = useState<ExclusionFormState>({
    reason: "",
    userId: initialUsers[0]?.authUserId ?? "",
  });
  const [exclusions, setExclusions] = useState(initialExclusions);
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = useState(initialSelectedTermId);
  const [status, setStatus] = useState<NoticeStatus>("idle");
  const [tab, setTab] = useState<PanelTab>("terms");
  const [termForm, setTermForm] = useState<TermFormState>(emptyTermForm);
  const [terms, setTerms] = useState(initialTerms);

  const userById = useMemo(
    () => new Map(initialUsers.map((user) => [user.authUserId, user])),
    [initialUsers],
  );
  const selectedTerm = terms.find((term) => term.$id === selectedTermId);
  const activeExclusions = exclusions.filter(isActiveTopBoardExclusion);

  function setNotice(nextStatus: NoticeStatus, nextMessage: string) {
    setStatus(nextStatus);
    setMessage(nextMessage);
  }

  function resetTermForm() {
    setEditingTermId(null);
    setTermForm(emptyTermForm);
  }

  function useSuggestedTermDates() {
    const suggested = getSuggestedTermRange();

    setTermForm((current) => ({
      ...current,
      endDate: suggested.endDate,
      startDate: suggested.startDate,
    }));
  }

  async function refreshTerms(
    nextMessage = "IEEE terms refreshed.",
    preferredTermId?: string,
  ) {
    const response = await fetch("/api/admin/settings/terms");
    const payload = await response.json();

    if (!response.ok) {
      setNotice("error", payload.error ?? "Could not refresh terms.");
      return;
    }

    const nextTerms = payload.terms as IeeeTerm[];
    const nextActiveTermId = nextTerms.find((term) => term.active)?.$id ?? "";
    const nextSelectedTermId =
      preferredTermId &&
      nextTerms.some((term) => term.$id === preferredTermId)
        ? preferredTermId
        : selectedTermId &&
            nextTerms.some((term) => term.$id === selectedTermId)
        ? selectedTermId
        : nextActiveTermId || nextTerms[0]?.$id || "";

    setTerms(nextTerms);
    setActiveTermId(nextActiveTermId);
    setSelectedTermId(nextSelectedTermId);
    setNotice("success", nextMessage);

    if (nextSelectedTermId) {
      await refreshExclusions(nextSelectedTermId, false);
    }
  }

  async function submitTerm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("term:save");
    setNotice("idle", editingTermId ? "Updating IEEE term..." : "Creating IEEE term...");

    try {
      const response = await fetch(
        editingTermId
          ? `/api/admin/settings/terms/${editingTermId}`
          : "/api/admin/settings/terms",
        {
          body: JSON.stringify({
            ...termForm,
            label: formatSafeTermLabel(termForm.startDate),
          }),
          headers: { "Content-Type": "application/json" },
          method: editingTermId ? "PATCH" : "POST",
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        setNotice("error", payload.error ?? "Term save failed.");
        return;
      }

      resetTermForm();
      await refreshTerms(editingTermId ? "IEEE term updated." : "IEEE term created.");
    } finally {
      setPendingAction(null);
    }
  }

  async function activateTerm(termId: string) {
    setPendingAction(`term:activate:${termId}`);
    setNotice("idle", "Activating IEEE term...");

    try {
      const response = await fetch(`/api/admin/settings/terms/${termId}/activate`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setNotice("error", payload.error ?? "Term activation failed.");
        return;
      }

      await refreshTerms("IEEE term activated.", (payload.term as IeeeTerm).$id);
    } finally {
      setPendingAction(null);
    }
  }

  async function closeTerm(term: IeeeTerm) {
    setPendingAction(`term:close:${term.$id}`);
    setNotice("idle", "Closing IEEE term...");

    try {
      const response = await fetch(`/api/admin/settings/terms/${term.$id}`, {
        body: JSON.stringify({
          endDate: term.endDate,
          label: term.label,
          notes: term.notes ?? "",
          startDate: term.startDate,
          status: "CLOSED",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = await response.json();

      if (!response.ok) {
        setNotice("error", payload.error ?? "Term close failed.");
        return;
      }

      await refreshTerms("IEEE term closed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function refreshExclusions(termId = selectedTermId, showMessage = true) {
    if (!termId) {
      setExclusions([]);
      return;
    }

    const response = await fetch(
      `/api/admin/settings/top-board-exclusions?termId=${encodeURIComponent(termId)}`,
    );
    const payload = await response.json();

    if (!response.ok) {
      setNotice("error", payload.error ?? "Could not load Top Board exclusions.");
      return;
    }

    setExclusions(payload.exclusions);

    if (showMessage) {
      setNotice("success", "Top Board exclusions refreshed.");
    }
  }

  async function submitExclusion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTermId) {
      setNotice("error", "Create and select an IEEE term before adding exclusions.");
      return;
    }

    setPendingAction("exclusion:add");
    setNotice("idle", "Adding Top Board exclusion...");

    try {
      const response = await fetch("/api/admin/settings/top-board-exclusions", {
        body: JSON.stringify({
          reason: exclusionForm.reason,
          termId: selectedTermId,
          userId: exclusionForm.userId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setNotice("error", payload.error ?? "Could not add exclusion.");
        return;
      }

      setExclusionForm((current) => ({ ...current, reason: "" }));
      await refreshExclusions(selectedTermId, false);
      setNotice("success", "Top Board exclusion added.");
    } finally {
      setPendingAction(null);
    }
  }

  async function revokeExclusion(exclusionId: string) {
    setPendingAction(`exclusion:revoke:${exclusionId}`);
    setNotice("idle", "Revoking Top Board exclusion...");

    try {
      const response = await fetch(
        `/api/admin/settings/top-board-exclusions/${exclusionId}/revoke`,
        { method: "POST" },
      );
      const payload = await response.json();

      if (!response.ok) {
        setNotice("error", payload.error ?? "Could not revoke exclusion.");
        return;
      }

      await refreshExclusions(selectedTermId, false);
      setNotice("success", "Top Board exclusion revoked.");
    } finally {
      setPendingAction(null);
    }
  }

  async function loadAuditLogs({
    append,
    cursor,
  }: {
    append: boolean;
    cursor?: string;
  }) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(auditFilters)) {
      if (value.trim()) {
        params.set(key, value.trim());
      }
    }

    params.set("limit", "25");

    if (cursor) {
      params.set("cursor", cursor);
    }

    setPendingAction(append ? "audit:load-more" : "audit:refresh");
    setNotice("idle", "Loading audit logs...");

    try {
      const response = await fetch(
        `/api/admin/settings/audit-logs${params.size ? `?${params}` : ""}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        setNotice("error", payload.error ?? "Could not load audit logs.");
        return;
      }

      const page = payload as AuditLogPage;

      setAuditLogs((current) =>
        append ? [...current, ...page.auditLogs] : page.auditLogs,
      );
      setAuditNextCursor(page.nextCursor ?? "");
      setAuditTotal(page.total);
      setNotice(
        "success",
        append ? "More audit records loaded." : "Audit logs loaded.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function refreshAuditLogs(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await loadAuditLogs({ append: false });
  }

  async function loadMoreAuditLogs() {
    if (!auditNextCursor) {
      return;
    }

    await loadAuditLogs({ append: true, cursor: auditNextCursor });
  }

  async function runConfirmedAction() {
    if (!confirmation) {
      return;
    }

    const current = confirmation;
    setConfirmation(null);

    if (current.kind === "activate-term") {
      await activateTerm(current.term.$id);
      return;
    }

    if (current.kind === "close-term") {
      await closeTerm(current.term);
      return;
    }

    await revokeExclusion(current.exclusion.$id);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <SummaryTile label="IEEE terms" value={String(terms.length)} />
        <SummaryTile
          label="Active term"
          value={activeTermId ? terms.find((term) => term.$id === activeTermId)?.label ?? "Set" : "None"}
        />
        <SummaryTile label="Top Board exclusions" value={String(activeExclusions.length)} />
        <SummaryTile label="Audit records" value={String(auditTotal)} />
      </section>

      <div className="inline-flex flex-wrap rounded-md border border-border bg-surface p-1">
        <TabButton active={tab === "terms"} icon={CalendarRange} label="Terms" onClick={() => setTab("terms")} />
        <TabButton active={tab === "exclusions"} icon={UserMinus} label="Top Board Exclusions" onClick={() => setTab("exclusions")} />
        <TabButton active={tab === "permissions"} icon={ShieldCheck} label="Permissions" onClick={() => setTab("permissions")} />
        <TabButton active={tab === "audit"} icon={History} label="Audit" onClick={() => setTab("audit")} />
      </div>

      {message ? <Notice message={message} status={status} /> : null}

      {tab === "terms" ? (
        <TermsPanel
          activeTermId={activeTermId}
          editingTermId={editingTermId}
          pendingAction={pendingAction}
          requestActivate={(term) => setConfirmation({ kind: "activate-term", term })}
          requestClose={(term) => setConfirmation({ kind: "close-term", term })}
          resetTermForm={resetTermForm}
          setEditingTermId={setEditingTermId}
          setTermForm={setTermForm}
          submitTerm={submitTerm}
          termForm={termForm}
          terms={terms}
          useSuggestedTermDates={useSuggestedTermDates}
        />
      ) : null}

      {tab === "exclusions" ? (
        <TopBoardExclusionsPanel
          exclusionForm={exclusionForm}
          exclusions={exclusions}
          pendingAction={pendingAction}
          refreshExclusions={refreshExclusions}
          requestRevoke={(exclusion) =>
            setConfirmation({
              exclusion,
              kind: "revoke-exclusion",
              userName: getUserDisplayName(userById.get(exclusion.userId), exclusion.userId),
            })
          }
          selectedTerm={selectedTerm}
          selectedTermId={selectedTermId}
          setExclusionForm={setExclusionForm}
          setSelectedTermId={setSelectedTermId}
          submitExclusion={submitExclusion}
          terms={terms}
          userById={userById}
          users={initialUsers}
        />
      ) : null}

      {tab === "permissions" ? (
        <PermissionsPanel permissions={initialPermissions} />
      ) : null}

      {tab === "audit" ? (
        <AuditPanel
          auditFilters={auditFilters}
          auditLogs={auditLogs}
          auditNextCursor={auditNextCursor}
          auditTotal={auditTotal}
          loadMoreAuditLogs={loadMoreAuditLogs}
          pendingAction={pendingAction}
          refreshAuditLogs={refreshAuditLogs}
          setAuditFilters={setAuditFilters}
        />
      ) : null}

      <ConfirmationDialog
        confirmation={confirmation}
        isBusy={Boolean(pendingAction)}
        onCancel={() => setConfirmation(null)}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}

function TermsPanel({
  activeTermId,
  editingTermId,
  pendingAction,
  requestActivate,
  requestClose,
  resetTermForm,
  setEditingTermId,
  setTermForm,
  submitTerm,
  termForm,
  terms,
  useSuggestedTermDates,
}: {
  activeTermId: string;
  editingTermId: string | null;
  pendingAction: string | null;
  requestActivate: (term: IeeeTerm) => void;
  requestClose: (term: IeeeTerm) => void;
  resetTermForm: () => void;
  setEditingTermId: React.Dispatch<React.SetStateAction<string | null>>;
  setTermForm: React.Dispatch<React.SetStateAction<TermFormState>>;
  submitTerm: (event: React.FormEvent<HTMLFormElement>) => void;
  termForm: TermFormState;
  terms: IeeeTerm[];
  useSuggestedTermDates: () => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <form
        className="rounded-md border border-border bg-surface-subtle p-4"
        onSubmit={submitTerm}
      >
        <div className="flex items-center gap-2">
          <CalendarRange className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-primary">
            {editingTermId ? "Edit IEEE term" : "Create IEEE term"}
          </h3>
        </div>
        <p className="mt-2 text-xs leading-5 text-text-secondary">
          Suggested terms use October 1 to September 30. Admin can edit exact dates after each AGM.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-text-secondary">
            Label
            <input
              className={cn(inputClasses, "mt-1 bg-surface-muted")}
              readOnly
              required
              value={formatSafeTermLabel(termForm.startDate)}
            />
            <span className="mt-1 block text-xs text-text-muted">
              Automatically derived from the selected start year.
            </span>
          </label>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <label className="block text-sm font-medium text-text-secondary">
              Start date
              <input
                className={cn(inputClasses, "mt-1")}
                onChange={(event) =>
                  setTermForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                required
                type="date"
                value={termForm.startDate}
              />
            </label>

            <label className="block text-sm font-medium text-text-secondary">
              End date
              <input
                className={cn(inputClasses, "mt-1")}
                onChange={(event) =>
                  setTermForm((current) => ({ ...current, endDate: event.target.value }))
                }
                required
                type="date"
                value={termForm.endDate}
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-text-secondary">
            Notes
            <textarea
              className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary"
              onChange={(event) =>
                setTermForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="AGM notes, transition details, or admin remarks"
              value={termForm.notes}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={pendingAction === "term:save"}
            type="submit"
            variant="primary"
          >
            <Check className="size-4" aria-hidden="true" />
            {editingTermId ? "Update Term" : "Create Term"}
          </Button>
          <Button onClick={useSuggestedTermDates} type="button">
            <RefreshCw className="size-4" aria-hidden="true" />
            Suggested Dates
          </Button>
          {editingTermId ? (
            <Button onClick={resetTermForm} type="button" variant="ghost">
              Cancel Edit
            </Button>
          ) : null}
        </div>
      </form>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-[900px] divide-y divide-border text-left text-sm">
          <thead className="bg-surface-muted text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">Term</th>
              <th className="px-4 py-3 font-semibold">Dates</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {terms.map((term) => (
              <tr key={term.$id}>
                <td className="px-4 py-4">
                  <p className="font-medium text-text-primary">{term.label}</p>
                  {term.notes ? (
                    <p className="mt-1 max-w-72 text-xs leading-5 text-text-muted">
                      {term.notes}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-text-secondary">
                  {term.startDate} to {term.endDate}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={term.active ? "success" : term.status === "CLOSED" ? "neutral" : "warning"}>
                      {term.active ? "Active" : term.status}
                    </Badge>
                    {term.$id === activeTermId ? <Badge tone="primary">Selected</Badge> : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-text-secondary">
                  {formatDisplayDate(term.updatedAt)}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {term.status !== "CLOSED" ? (
                      <Button
                        onClick={() => {
                          setEditingTermId(term.$id);
                          setTermForm({
                            endDate: term.endDate,
                            notes: term.notes ?? "",
                            startDate: term.startDate,
                            status: "DRAFT",
                          });
                        }}
                        type="button"
                      >
                        Edit
                      </Button>
                    ) : (
                      <span className="text-xs font-medium text-text-muted">
                        Historical record
                      </span>
                    )}
                    {!term.active && term.status !== "CLOSED" ? (
                      <Button
                        disabled={pendingAction === `term:activate:${term.$id}`}
                        onClick={() => requestActivate(term)}
                        type="button"
                        variant="primary"
                      >
                        Set Active
                      </Button>
                    ) : null}
                    {term.status !== "CLOSED" ? (
                      <Button
                        disabled={pendingAction === `term:close:${term.$id}`}
                        onClick={() => requestClose(term)}
                        type="button"
                        variant="ghost"
                      >
                        Close
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {terms.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-text-secondary" colSpan={5}>
                  No IEEE terms are configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopBoardExclusionsPanel({
  exclusionForm,
  exclusions,
  pendingAction,
  refreshExclusions,
  requestRevoke,
  selectedTerm,
  selectedTermId,
  setExclusionForm,
  setSelectedTermId,
  submitExclusion,
  terms,
  userById,
  users,
}: {
  exclusionForm: ExclusionFormState;
  exclusions: TopBoardExclusion[];
  pendingAction: string | null;
  refreshExclusions: (termId?: string, showMessage?: boolean) => Promise<void>;
  requestRevoke: (exclusion: TopBoardExclusion) => void;
  selectedTerm?: IeeeTerm;
  selectedTermId: string;
  setExclusionForm: React.Dispatch<React.SetStateAction<ExclusionFormState>>;
  setSelectedTermId: React.Dispatch<React.SetStateAction<string>>;
  submitExclusion: (event: React.FormEvent<HTMLFormElement>) => void;
  terms: IeeeTerm[];
  userById: Map<string, Profile>;
  users: Profile[];
}) {
  const activeExclusions = exclusions.filter(isActiveTopBoardExclusion);

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <form
        className="rounded-md border border-border bg-surface-subtle p-4"
        onSubmit={submitExclusion}
      >
        <div className="flex items-center gap-2">
          <UserMinus className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-primary">
            Add Top Board exclusion
          </h3>
        </div>
        <p className="mt-2 text-xs leading-5 text-text-secondary">
          Exclusions are stored per IEEE term for later leaderboard calculations.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-text-secondary">
            IEEE term
            <select
              className={cn(inputClasses, "mt-1")}
              disabled={terms.length === 0}
              onChange={async (event) => {
                setSelectedTermId(event.target.value);
                await refreshExclusions(event.target.value, false);
              }}
              value={selectedTermId}
            >
              {terms.length > 0 ? (
                terms.map((term) => (
                  <option key={term.$id} value={term.$id}>
                    {term.label} ({term.active ? "Active" : term.status})
                  </option>
                ))
              ) : (
                <option value="">No terms configured</option>
              )}
            </select>
          </label>

          <label className="block text-sm font-medium text-text-secondary">
            User
            <select
              className={cn(inputClasses, "mt-1")}
              disabled={users.length === 0}
              onChange={(event) =>
                setExclusionForm((current) => ({
                  ...current,
                  userId: event.target.value,
                }))
              }
              value={exclusionForm.userId}
            >
              {users.length > 0 ? (
                users.map((user) => (
                  <option key={user.authUserId} value={user.authUserId}>
                    {getUserDisplayName(user, user.authUserId)} -{" "}
                    {user.uomEmail ?? user.googleEmail}
                  </option>
                ))
              ) : (
                <option value="">No profiles available</option>
              )}
            </select>
          </label>

          <label className="block text-sm font-medium text-text-secondary">
            Reason
            <textarea
              className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary"
              onChange={(event) =>
                setExclusionForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              placeholder="Top Board member for the selected IEEE term"
              required
              value={exclusionForm.reason}
            />
          </label>
        </div>

        <Button
          className="mt-4 w-full"
          disabled={
            pendingAction === "exclusion:add" ||
            !selectedTermId ||
            !exclusionForm.userId ||
            users.length === 0
          }
          type="submit"
          variant="primary"
        >
          <UserMinus className="size-4" aria-hidden="true" />
          Add Exclusion
        </Button>
      </form>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-[820px] divide-y divide-border text-left text-sm">
          <thead className="bg-surface-muted text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Term</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {exclusions.map((exclusion) => {
              const user = userById.get(exclusion.userId);
              const isActive = isActiveTopBoardExclusion(exclusion);

              return (
                <tr key={exclusion.$id}>
                  <td className="px-4 py-4">
                    <p className="font-medium text-text-primary">
                      {getUserDisplayName(user, exclusion.userId)}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {user?.googleEmail ?? exclusion.userId}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-text-secondary">
                    {selectedTerm?.label ?? exclusion.termId}
                  </td>
                  <td className="px-4 py-4 text-text-secondary">{exclusion.reason}</td>
                  <td className="px-4 py-4">
                    <Badge tone={isActive ? "warning" : "neutral"}>
                      {isActive ? "Excluded" : "Revoked"}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    {isActive ? (
                      <Button
                        disabled={pendingAction === `exclusion:revoke:${exclusion.$id}`}
                        onClick={() => requestRevoke(exclusion)}
                        type="button"
                        variant="ghost"
                      >
                        <ShieldMinus className="size-4" aria-hidden="true" />
                        Review Revoke
                      </Button>
                    ) : (
                      <span className="text-xs text-text-muted">No action</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {exclusions.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-text-secondary" colSpan={5}>
                  {selectedTermId
                    ? "No Top Board exclusions found for this term."
                    : "Create an IEEE term before adding Top Board exclusions."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {activeExclusions.length === 0 && exclusions.length > 0 ? (
          <p className="border-t border-border px-4 py-3 text-sm text-text-secondary">
            No active exclusions remain for this term.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PermissionsPanel({ permissions }: { permissions: PermissionOverview }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <section className="rounded-md border border-border bg-surface-subtle p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-primary">Admin Source</h3>
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-text-secondary">Source</dt>
            <dd className="mt-1 text-text-primary">{permissions.adminSource}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-secondary">Configured email</dt>
            <dd className="mt-1 break-all text-text-primary">{permissions.adminEmail}</dd>
          </div>
        </dl>
        <div className="mt-4 space-y-2">
          {permissions.notes.map((note) => (
            <p className="text-xs leading-5 text-text-secondary" key={note}>
              {note}
            </p>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <RoleTable
          rows={permissions.sbRoles}
          title="Student Branch Roles"
        />
        <RoleTable
          rows={permissions.eventRoles}
          title="Event Roles"
        />
      </div>
    </div>
  );
}

function AuditPanel({
  auditFilters,
  auditLogs,
  auditNextCursor,
  auditTotal,
  loadMoreAuditLogs,
  pendingAction,
  refreshAuditLogs,
  setAuditFilters,
}: {
  auditFilters: AuditFilters;
  auditLogs: AuditLog[];
  auditNextCursor: string;
  auditTotal: number;
  loadMoreAuditLogs: () => Promise<void>;
  pendingAction: string | null;
  refreshAuditLogs: (event?: React.FormEvent<HTMLFormElement>) => void;
  setAuditFilters: React.Dispatch<React.SetStateAction<AuditFilters>>;
}) {
  const actionOptions = Array.from(
    new Set([...auditActionOptions, ...auditLogs.map((log) => log.action)]),
  ).sort();

  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 rounded-md border border-border bg-surface-subtle p-4 lg:grid-cols-6"
        onSubmit={refreshAuditLogs}
      >
        <label className="block text-sm font-medium text-text-secondary lg:col-span-2">
          Action
          <select
            className={cn(inputClasses, "mt-1")}
            onChange={(event) =>
              setAuditFilters((current) => ({ ...current, action: event.target.value }))
            }
            value={auditFilters.action}
          >
            <option value="">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-text-secondary">
          Actor ID
          <input
            className={cn(inputClasses, "mt-1")}
            onChange={(event) =>
              setAuditFilters((current) => ({
                ...current,
                actorUserId: event.target.value,
              }))
            }
            placeholder="Appwrite user ID"
            value={auditFilters.actorUserId}
          />
        </label>
        <label className="block text-sm font-medium text-text-secondary">
          Target ID
          <input
            className={cn(inputClasses, "mt-1")}
            onChange={(event) =>
              setAuditFilters((current) => ({
                ...current,
                targetId: event.target.value,
              }))
            }
            placeholder="Target ID"
            value={auditFilters.targetId}
          />
        </label>
        <label className="block text-sm font-medium text-text-secondary">
          From
          <input
            className={cn(inputClasses, "mt-1")}
            onChange={(event) =>
              setAuditFilters((current) => ({ ...current, dateFrom: event.target.value }))
            }
            type="date"
            value={auditFilters.dateFrom}
          />
        </label>
        <label className="block text-sm font-medium text-text-secondary">
          To
          <input
            className={cn(inputClasses, "mt-1")}
            onChange={(event) =>
              setAuditFilters((current) => ({ ...current, dateTo: event.target.value }))
            }
            type="date"
            value={auditFilters.dateTo}
          />
        </label>
        <div className="flex items-end">
          <Button
            className="w-full"
            disabled={pendingAction === "audit:refresh"}
            type="submit"
            variant="primary"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Load
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-[980px] divide-y divide-border text-left text-sm">
          <thead className="bg-surface-muted text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold">Target</th>
              <th className="px-4 py-3 font-semibold">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {auditLogs.map((log) => (
              <tr key={log.$id}>
                <td className="px-4 py-4 text-text-secondary">
                  {formatDisplayDateTime(log.createdAt)}
                </td>
                <td className="px-4 py-4">
                  <Badge tone="primary">{log.action}</Badge>
                </td>
                <td className="px-4 py-4 text-text-secondary">
                  {log.actorUserId ?? "System"}
                </td>
                <td className="px-4 py-4 text-text-secondary">
                  <p>{log.targetType}</p>
                  <p className="mt-1 max-w-48 truncate text-xs">{log.targetId}</p>
                </td>
                <td className="max-w-96 break-words px-4 py-4 text-xs leading-5 text-text-secondary">
                  {log.metadata ? JSON.stringify(log.metadata) : "None"}
                </td>
              </tr>
            ))}
            {auditLogs.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-text-secondary" colSpan={5}>
                  No audit logs found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Showing {auditLogs.length} of {auditTotal} records
        </p>
        {auditNextCursor ? (
          <Button
            disabled={pendingAction === "audit:load-more"}
            onClick={loadMoreAuditLogs}
            type="button"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Load More
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RoleTable({
  rows,
  title,
}: {
  rows: Array<{ notes: string; role: string; scope: string }>;
  title: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-[420px] divide-y divide-border text-left text-sm">
        <thead className="bg-surface-muted text-text-secondary">
          <tr>
            <th className="px-4 py-3 font-semibold" colSpan={2}>{title}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {rows.map((row) => (
            <tr key={row.role}>
              <td className="px-4 py-4">
                <Badge tone="primary">{row.role}</Badge>
                <p className="mt-2 text-xs text-text-muted">{row.scope}</p>
              </td>
              <td className="px-4 py-4 text-text-secondary">{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfirmationDialog({
  confirmation,
  isBusy,
  onCancel,
  onConfirm,
}: {
  confirmation: Confirmation | null;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!confirmation) {
    return null;
  }

  const details = getConfirmationDetails(confirmation);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-warning/25 bg-warning-soft text-warning">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                Confirm System Change
              </h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Review this action before it is written to the system audit trail.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          {details.map((detail) => (
            <div
              className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0"
              key={detail.label}
            >
              <span className="font-medium text-text-secondary">{detail.label}</span>
              <span className="text-right font-medium text-text-primary">
                {detail.value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button disabled={isBusy} onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={onConfirm} type="button" variant="primary">
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

function getConfirmationDetails(confirmation: Confirmation) {
  if (confirmation.kind === "activate-term") {
    return [
      { label: "Action", value: "Set active IEEE term" },
      { label: "Term", value: confirmation.term.label },
      { label: "Dates", value: `${confirmation.term.startDate} to ${confirmation.term.endDate}` },
    ];
  }

  if (confirmation.kind === "close-term") {
    return [
      { label: "Action", value: "Close IEEE term" },
      { label: "Term", value: confirmation.term.label },
      { label: "Dates", value: `${confirmation.term.startDate} to ${confirmation.term.endDate}` },
      {
        label: "Important",
        value: "Closed terms are permanent historical records and cannot be reopened.",
      },
    ];
  }

  return [
    { label: "Action", value: "Revoke Top Board exclusion" },
    { label: "User", value: confirmation.userName },
    { label: "Reason", value: confirmation.exclusion.reason },
  ];
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle px-4 py-3">
      <p className="text-xs font-semibold uppercase text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-white"
          : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function Notice({ message, status }: { message: string; status: NoticeStatus }) {
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        status === "error" && "border-danger/25 bg-danger-soft text-danger",
        status === "success" && "border-success/25 bg-success-soft text-success",
        status === "idle" && "border-border bg-surface-muted text-text-secondary",
      )}
    >
      {message}
    </div>
  );
}

function getUserDisplayName(user: Profile | undefined, fallback: string) {
  return user?.name || user?.uomEmail || user?.googleEmail || fallback;
}

function formatSafeTermLabel(date: string) {
  try {
    return formatTermLabel(date);
  } catch {
    return "";
  }
}
