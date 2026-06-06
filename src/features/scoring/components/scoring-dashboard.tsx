"use client";

import { useEffect, useState, startTransition } from "react";
import {
  Trophy,
  Award,
  BookOpen,
  CalendarCheck2,
  Sliders,
  AlertCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SessionUser } from "@/features/access-control/types";
import {
  upsertParticipationRecord,
  toggleTopBoardExclusion,
} from "../server/actions";
import type {
  PointLedgerEntry,
  GradeRequest,
} from "../types";

export function ScoringDashboard({ user }: { user: SessionUser }) {
  const [activeTab, setActiveTab] = useState<
    "leaderboard" | "my-points" | "grading" | "participation" | "admin"
  >("leaderboard");

  const [leaderboard, setLeaderboard] = useState<
    { userId: string; name: string; points: number }[]
  >([]);
  const [ledger, setLedger] = useState<PointLedgerEntry[]>([]);
  const [gradeRequests, setGradeRequests] = useState<GradeRequest[]>([]);

  // Filters for Leaderboard
  const [filterTerm, setFilterTerm] = useState("2026");
  const [filterYear, setFilterYear] = useState("2026");
  const [filterMonth, setFilterMonth] = useState("");

  // Form states
  const [partUserId, setPartUserId] = useState("");
  const [partEventId, setPartEventId] = useState("");
  const [partRole, setPartRole] = useState("Committee Member");
  const [partStatus, setPartStatus] = useState<"attended" | "absent" | "excused">("attended");

  const [reqEventId, setReqEventId] = useState("");
  const [reqTargetUserId, setReqTargetUserId] = useState("");
  const [reqGradeValue, setReqGradeValue] = useState(5);

  const [revRequestId, setRevRequestId] = useState("");
  const [revGradeValue, setRevGradeValue] = useState(5);



  const [overReviewId, setOverReviewId] = useState("");
  const [overGradeValue, setOverGradeValue] = useState(5);
  const [overReason, setOverReason] = useState("");

  const [exUserId, setExUserId] = useState("");
  const [exTerm, setExTerm] = useState("2026");
  const [exYear, setExYear] = useState(2026);
  const [exExcluded, setExExcluded] = useState(true);
  const [exReason, setExReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filterTerm) q.set("term", filterTerm);
      if (filterYear) q.set("year", filterYear);
      if (filterMonth) q.set("month", filterMonth);

      const res = await fetch(`/api/scoring/leaderboard?${q.toString()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch logged in user points
  const fetchMyPoints = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scoring/volunteers/${user.authUser.id}/points`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLedger(data.points || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load point ledger.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch active grade requests
  const fetchGradeRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scoring/grade-requests`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGradeRequests(data.gradeRequests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grade requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (activeTab === "leaderboard") {
        await fetchLeaderboard();
      } else if (activeTab === "my-points") {
        await fetchMyPoints();
      } else if (activeTab === "grading") {
        await fetchGradeRequests();
      }
    };
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterTerm, filterYear, filterMonth]);

  // Form submission helpers
  const handleParticipationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await upsertParticipationRecord({
        userId: partUserId,
        eventId: partEventId,
        role: partRole,
        status: partStatus,
      });
      setSuccess("Participation record recorded successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upsert participation.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab bar header */}
      <div className="flex border-b border-border bg-surface px-4 py-2 rounded-t-lg gap-2 overflow-x-auto">
        <button
          onClick={() => startTransition(() => setActiveTab("leaderboard"))}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            activeTab === "leaderboard"
              ? "bg-primary-soft text-primary border border-primary/20"
              : "text-text-secondary hover:bg-surface-muted"
          }`}
        >
          <Trophy className="size-4" />
          Leaderboard
        </button>

        <button
          onClick={() => startTransition(() => setActiveTab("my-points"))}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            activeTab === "my-points"
              ? "bg-primary-soft text-primary border border-primary/20"
              : "text-text-secondary hover:bg-surface-muted"
          }`}
        >
          <Award className="size-4" />
          My Points
        </button>

        <button
          onClick={() => startTransition(() => setActiveTab("grading"))}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            activeTab === "grading"
              ? "bg-primary-soft text-primary border border-primary/20"
              : "text-text-secondary hover:bg-surface-muted"
          }`}
        >
          <BookOpen className="size-4" />
          Grading Request Flow
        </button>

        {(user.isAdmin || user.eventRoles.some((r) => r.active && r.role === "Chair")) && (
          <button
            onClick={() => startTransition(() => setActiveTab("participation"))}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === "participation"
                ? "bg-primary-soft text-primary border border-primary/20"
                : "text-text-secondary hover:bg-surface-muted"
            }`}
          >
            <CalendarCheck2 className="size-4" />
            Participation
          </button>
        )}

        {user.isAdmin && (
          <button
            onClick={() => startTransition(() => setActiveTab("admin"))}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === "admin"
                ? "bg-primary-soft text-primary border border-primary/20"
                : "text-text-secondary hover:bg-surface-muted"
            }`}
          >
            <Sliders className="size-4" />
            Admin Override
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="size-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
          <AlertCircle className="size-4" />
          <span>{success}</span>
        </div>
      )}

      {/* Tab Panels */}
      {activeTab === "leaderboard" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div>
                <CardTitle>IEEE SB UoM Leaderboard</CardTitle>
                <CardDescription>
                  Volunteers ranked by aggregated points from point ledger.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Term (e.g. 2026)"
                  value={filterTerm}
                  onChange={(e) => setFilterTerm(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm w-32 bg-surface"
                />
                <input
                  type="number"
                  placeholder="Year (e.g. 2026)"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm w-28 bg-surface"
                />
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm bg-surface"
                >
                  <option value="">Full Year</option>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
                <Button onClick={fetchLeaderboard} className="flex items-center gap-1">
                  <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-6 text-text-secondary">Loading leaderboard...</div>
            ) : leaderboard.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-left text-sm">
                  <thead className="text-text-secondary">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Rank</th>
                      <th className="px-4 py-2 font-semibold">Volunteer Name</th>
                      <th className="px-4 py-2 font-semibold">User ID</th>
                      <th className="px-4 py-2 font-semibold text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leaderboard.map((row, index) => (
                      <tr
                        key={row.userId}
                        className={row.userId === user.authUser.id ? "bg-primary-soft/10" : ""}
                      >
                        <td className="py-3 pr-4 font-semibold">
                          {index === 0 && "🥇 "}
                          {index === 1 && "🥈 "}
                          {index === 2 && "🥉 "}
                          {index > 2 && `${index + 1}`}
                        </td>
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {row.name} {row.userId === user.authUser.id && <Badge tone="primary">Self</Badge>}
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs">{row.userId}</td>
                        <td className="px-4 py-3 text-right font-bold text-text-primary text-base">
                          {row.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-6 text-text-secondary">
                No ledger entries found matching these filters.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "my-points" && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>My Point Ledger</CardTitle>
                <CardDescription>
                  Your total accumulated points on the volunteer management platform.
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase text-text-secondary font-medium">Total Points</p>
                <p className="text-3xl font-extrabold text-primary">
                  {ledger.reduce((acc, r) => acc + r.points, 0)}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-6 text-text-secondary">Loading ledger...</div>
            ) : ledger.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-left text-sm">
                  <thead className="text-text-secondary">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Event / Task</th>
                      <th className="px-4 py-2 font-semibold">Source</th>
                      <th className="px-4 py-2 font-semibold">Awarded Date</th>
                      <th className="px-4 py-2 font-semibold text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ledger.map((entry) => (
                      <tr key={entry.$id}>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-text-primary">{entry.eventId}</p>
                          <p className="text-xs text-text-muted">Recorded by {entry.createdBy}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            tone={
                              entry.source === "grade"
                                ? "success"
                                : entry.source === "role"
                                ? "primary"
                                : "warning"
                            }
                          >
                            {entry.source}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {new Date(entry.conclusionApprovalDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-text-primary">
                          +{entry.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-6 text-text-secondary">
                You have not received any points yet. Participate in events and get graded to accumulate points!
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "grading" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submit Grade Request</CardTitle>
              <CardDescription>
                Event Chairs and Leads can submit grades for volunteers under their event. (Chairs cannot grade their own event).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  setSuccess(null);
                  try {
                    const res = await fetch("/api/scoring/grade-requests", {
                      method: "POST",
                      body: JSON.stringify({
                        eventId: reqEventId,
                        targetUserId: reqTargetUserId,
                        gradeValue: Number(reqGradeValue),
                      }),
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    setSuccess("Grade request submitted successfully!");
                    fetchGradeRequests();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to submit request.");
                  }
                }}
                className="grid gap-4 md:grid-cols-3 items-end"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Event Reference / ID
                  </label>
                  <input
                    type="text"
                    required
                    value={reqEventId}
                    onChange={(e) => setReqEventId(e.target.value)}
                    placeholder="e.g. MoraForesight 4.0"
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Volunteer User ID
                  </label>
                  <input
                    type="text"
                    required
                    value={reqTargetUserId}
                    onChange={(e) => setReqTargetUserId(e.target.value)}
                    placeholder="e.g. 6a22aee6ee323"
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Grade Value (0-10)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      required
                      value={reqGradeValue}
                      onChange={(e) => setReqGradeValue(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                    />
                  </div>
                  <Button type="submit" className="shrink-0 flex items-center gap-1 mt-5">
                    <Plus className="size-4" /> Submit
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Grading Requests</CardTitle>
              <CardDescription>
                Reviews and status logs of open volunteer grading workflows.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gradeRequests.length > 0 ? (
                <div className="space-y-4">
                  {gradeRequests.map((req) => (
                    <div
                      key={req.$id}
                      className="p-4 border border-border rounded-lg bg-surface flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-text-primary">
                            {req.eventId}
                          </span>
                          <Badge
                            tone={
                              req.status === "finalized"
                                ? "success"
                                : req.status === "reviewed"
                                ? "primary"
                                : "neutral"
                            }
                          >
                            {req.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-text-secondary">
                          Volunteer ID: <span className="font-mono">{req.targetUserId}</span> | Requested by: {req.requestedBy}
                        </p>
                      </div>

                      {/* Review & Finalize actions */}
                      {req.status !== "finalized" && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <input
                            type="number"
                            placeholder="Grade"
                            min="0"
                            max="10"
                            className="w-16 px-2 py-1 border border-border rounded text-sm bg-surface"
                            onChange={(e) => {
                              setRevRequestId(req.$id);
                              setRevGradeValue(Number(e.target.value));
                            }}
                          />
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              setError(null);
                              setSuccess(null);
                              try {
                                const targetId = revRequestId || req.$id;
                                const res = await fetch(`/api/scoring/grade-requests/${targetId}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ gradeValue: revGradeValue }),
                                });
                                const data = await res.json();
                                if (data.error) throw new Error(data.error);
                                setSuccess("Grade review submitted!");
                                fetchGradeRequests();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Failed to submit review.");
                              }
                            }}
                          >
                            Submit Review
                          </Button>
                          <Button
                            variant="primary"
                            onClick={async () => {
                              setError(null);
                              setSuccess(null);
                              try {
                                const res = await fetch("/api/scoring/grades", {
                                  method: "POST",
                                  body: JSON.stringify({ gradeRequestId: req.$id }),
                                });
                                const data = await res.json();
                                if (data.error) throw new Error(data.error);
                                setSuccess("Grading finalized and points awarded!");
                                fetchGradeRequests();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Failed to finalize grade.");
                              }
                            }}
                          >
                            Finalize
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-6 text-text-secondary">No grading requests found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "participation" && (
        <Card>
          <CardHeader>
            <CardTitle>Manage Participation Records</CardTitle>
            <CardDescription>
              Assign volunteer participation status and role for your event.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Create participation wrapper endpoint calling server action or route endpoint */}
            <form
              onSubmit={handleParticipationSubmit}
              className="space-y-4 max-w-md"
            >
              <div>
                <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                  Volunteer User ID
                </label>
                <input
                  type="text"
                  required
                  value={partUserId}
                  onChange={(e) => setPartUserId(e.target.value)}
                  placeholder="e.g. 6a22aee6ee323"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                  Event Reference / ID
                </label>
                <input
                  type="text"
                  required
                  value={partEventId}
                  onChange={(e) => setPartEventId(e.target.value)}
                  placeholder="e.g. MoraForesight 4.0"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Role In Event
                  </label>
                  <select
                    value={partRole}
                    onChange={(e) => setPartRole(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  >
                    <option value="Chair">Chair</option>
                    <option value="Vice Chair">Vice Chair</option>
                    <option value="Committee Lead">Committee Lead</option>
                    <option value="Committee Member">Committee Member</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Status
                  </label>
                  <select
                    value={partStatus}
                    onChange={(e) =>
                      setPartStatus(e.target.value as "attended" | "absent" | "excused")
                    }
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  >
                    <option value="attended">Attended</option>
                    <option value="absent">Absent</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full">
                Upsert Record
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "admin" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Admin override panel */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Grade Override</CardTitle>
              <CardDescription>
                Manually edit a grade review. Automatically logs audit details and preserves original grades.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  setSuccess(null);
                  try {
                    const res = await fetch("/api/scoring/admin/override", {
                      method: "POST",
                      body: JSON.stringify({
                        gradeReviewId: overReviewId,
                        newGradeValue: Number(overGradeValue),
                        reason: overReason,
                      }),
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    setSuccess("Grade overridden and audit ledger recorded!");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Override failed.");
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Grade Review ID
                  </label>
                  <input
                    type="text"
                    required
                    value={overReviewId}
                    onChange={(e) => setOverReviewId(e.target.value)}
                    placeholder="e.g. 6a22aee6ee323"
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    New Grade Value (0-10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    required
                    value={overGradeValue}
                    onChange={(e) => setOverGradeValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Reason for Override
                  </label>
                  <input
                    type="text"
                    value={overReason}
                    onChange={(e) => setOverReason(e.target.value)}
                    placeholder="e.g. Input mistake corrections"
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Override & Log Audit
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Top board config panel */}
          <Card>
            <CardHeader>
              <CardTitle>Top Board Exclusion</CardTitle>
              <CardDescription>
                Manually exclude a volunteer from the top board leaderboard for a given term.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  setSuccess(null);
                  try {
                    await toggleTopBoardExclusion({
                      userId: exUserId,
                      term: exTerm,
                      year: Number(exYear),
                      excluded: exExcluded,
                      reason: exReason,
                    });
                    setSuccess("Exclusion settings updated successfully!");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to update exclusion.");
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Volunteer User ID
                  </label>
                  <input
                    type="text"
                    required
                    value={exUserId}
                    onChange={(e) => setExUserId(e.target.value)}
                    placeholder="e.g. 6a22aee6ee323"
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Term
                    </label>
                    <input
                      type="text"
                      required
                      value={exTerm}
                      onChange={(e) => setExTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Year
                    </label>
                    <input
                      type="number"
                      required
                      value={exYear}
                      onChange={(e) => setExYear(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Top Board Status
                  </label>
                  <select
                    value={exExcluded ? "exclude" : "include"}
                    onChange={(e) => setExExcluded(e.target.value === "exclude")}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  >
                    <option value="exclude">Exclude from Top Board</option>
                    <option value="include">Include on Top Board</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={exReason}
                    onChange={(e) => setExReason(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Save Configuration
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
