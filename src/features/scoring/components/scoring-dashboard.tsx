"use client";

import { useEffect, useState, startTransition, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
  toggleTopBoardExclusion,
  listVolunteers,
  listDetailedReviews,
  getVolunteerActiveEventRole,
  listAllActiveEvents,
} from "../server/actions";
import type {
  PointLedgerEntry,
  GradeRequest,
  GradeAuditEntry,
} from "../types";

const ROLE_POINT_RANGES: Record<string, { min: number; max: number; base: number }> = {
  Chair: { min: 60, max: 70, base: 60 },
  "Vice Chair": { min: 40, max: 50, base: 40 },
  "Committee Lead": { min: 25, max: 35, base: 25 },
  "Committee Member": { min: 10, max: 20, base: 10 },
};

interface VolunteerOption {
  id: string;
  name: string;
}

interface DetailedGradeReview {
  $id: string;
  gradeRequestId: string;
  reviewerId: string;
  reviewerName: string;
  volunteerName: string;
  eventId: string;
  gradeValue: number;
  submittedAt: string;
  audit_metadata?: string;
}

export function VolunteerSelect({
  value,
  onChange,
  volunteers,
  loading,
  error,
  placeholder = "Select a volunteer...",
}: {
  value: string;
  onChange: (val: string) => void;
  volunteers: VolunteerOption[];
  loading: boolean;
  error: string | null;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isManual = manualMode || !!error;

  if (isManual) {
    return (
      <div className="space-y-1">
        <input
          type="text"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter Volunteer User ID manually"
          className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
        />
        {error && (
          <p className="text-xs text-red-500">
            Failed to load volunteers ({error}). Manual entry enabled.
          </p>
        )}
        {!error && (
          <button
            type="button"
            onClick={() => setManualMode(false)}
            className="text-xs text-primary underline"
          >
            Switch back to dropdown
          </button>
        )}
      </div>
    );
  }

  const selectedVolunteer = volunteers.find((v) => v.id === value);
  const filteredVolunteers = volunteers.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <div
        className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface flex justify-between items-center cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedVolunteer ? "text-text-primary" : "text-text-secondary"}>
          {selectedVolunteer ? selectedVolunteer.name : placeholder}
        </span>
        <span className="text-xs text-text-secondary">▼</span>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md bg-surface border border-border shadow-lg max-h-60 overflow-y-auto flex flex-col p-1 gap-1">
          <input
            type="text"
            placeholder="Search name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-2 py-1.5 text-sm border border-border rounded bg-surface-muted"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
          {loading ? (
            <div className="px-2 py-1.5 text-sm text-text-secondary font-medium">Loading...</div>
          ) : filteredVolunteers.length > 0 ? (
            filteredVolunteers.map((v) => (
              <div
                key={v.id}
                onClick={() => {
                  onChange(v.id);
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`px-2 py-1.5 text-sm rounded cursor-pointer transition-colors ${
                  v.id === value
                    ? "bg-primary-soft text-primary font-semibold"
                    : "hover:bg-surface-muted text-text-primary"
                }`}
              >
                {v.name}
              </div>
            ))
          ) : (
            <div className="px-2 py-1.5 text-sm text-text-secondary">No volunteers found</div>
          )}
          <div className="border-t border-border mt-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setManualMode(true);
                setIsOpen(false);
              }}
              className="w-full text-left px-2 py-1 text-xs text-primary hover:underline"
            >
              Enter User ID manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScoringDashboard({
  user,
  userRole,
}: {
  user: SessionUser;
  userRole?: "Admin" | "Chairperson" | "Member";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qEventId = searchParams.get("eventId");
  const qRole = searchParams.get("role");
  const [activeTab, setActiveTab] = useState<string>("leaderboard");

  const [leaderboard, setLeaderboard] = useState<
    { userId: string; name: string; points: number }[]
  >([]);
  const [ledger, setLedger] = useState<PointLedgerEntry[]>([]);

  // Selection states for Admin
  const [allEvents, setAllEvents] = useState<{ eventId: string; eventTitle: string }[]>([]);
  const [adminSelEvent, setAdminSelEvent] = useState("");
  const [adminSelRole, setAdminSelRole] = useState<"Admin" | "Chairperson" | "Member">("Admin");
  const [customEventId, setCustomEventId] = useState("");
  const [showCustomEvent, setShowCustomEvent] = useState(false);

  useEffect(() => {
    if (user.isAdmin) {
      async function fetchEvents() {
        try {
          const events = await listAllActiveEvents();
          setAllEvents(events);
          if (events.length > 0) {
            setAdminSelEvent(events[0].eventId);
          } else {
            setShowCustomEvent(true);
          }
        } catch {}
      }
      fetchEvents();
    }
  }, [user.isAdmin]);
  const [gradeRequests, setGradeRequests] = useState<GradeRequest[]>([]);

  // Derived role
  const derivedRole =
    userRole ||
    qRole ||
    (user.isAdmin
      ? "Admin"
      : user.eventRoles.some((r) => r.active && r.role === "Chair")
      ? "Chairperson"
      : "Member");

  const [prevRole, setPrevRole] = useState(derivedRole);
  if (derivedRole !== prevRole) {
    setPrevRole(derivedRole);
    setActiveTab("leaderboard");
  }

  // Dynamic tab list
  const tabs = (() => {
    switch (derivedRole) {
      case "Admin":
        return [
          { id: "leaderboard", label: "Leaderboard", icon: Trophy },
          { id: "point-ledger", label: "Point Ledger", icon: Award },
          { id: "grade-requests", label: "Grade Requests", icon: BookOpen },
          { id: "grade-reviews", label: "Grade Reviews", icon: BookOpen },
          { id: "finalize-grades", label: "Finalize Grades", icon: BookOpen },
          { id: "admin-tools", label: "Admin Tools", icon: Sliders },
        ];
      case "Chairperson":
        return [
          { id: "leaderboard", label: "Leaderboard", icon: Trophy },
          { id: "point-ledger", label: "Point Ledger", icon: Award },
          { id: "grade-requests", label: "Grade Requests", icon: BookOpen },
        ];
      case "Member":
      default:
        return [
          { id: "leaderboard", label: "Leaderboard", icon: Trophy },
          { id: "point-ledger", label: "Point Ledger", icon: Award },
        ];
    }
  })();

  const currentTab = tabs.some((t) => t.id === activeTab) ? activeTab : "leaderboard";

  // Volunteers state for selectors
  const [volunteers, setVolunteers] = useState<VolunteerOption[]>([]);
  const [volunteersLoading, setVolunteersLoading] = useState(false);
  const [volunteersError, setVolunteersError] = useState<string | null>(null);

  // Selected volunteer for admin point ledger
  const [selectedVolPointsId, setSelectedVolPointsId] = useState(user.authUser.id);

  // Detailed reviews for admin
  const [detailedReviews, setDetailedReviews] = useState<DetailedGradeReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Filters for Leaderboard
  const [filterTerm, setFilterTerm] = useState("2026");
  const [filterYear, setFilterYear] = useState("2026");
  const [filterMonth, setFilterMonth] = useState("");

  const [reqEventId, setReqEventId] = useState(qEventId || "");
  const [reqTargetUserId, setReqTargetUserId] = useState("");
  const [reqGradeValue, setReqGradeValue] = useState(10);
  const [gradingRole, setGradingRole] = useState("Committee Member");

  useEffect(() => {
    if (qEventId) {
      setReqEventId(qEventId);
    }
  }, [qEventId]);

  useEffect(() => {
    async function autoFetchRole() {
      if (reqTargetUserId && reqEventId) {
        try {
          const activeRole = await getVolunteerActiveEventRole(reqTargetUserId, reqEventId);
          if (activeRole) {
            setGradingRole(activeRole);
          }
        } catch {}
      }
    }
    autoFetchRole();
  }, [reqTargetUserId, reqEventId]);

  useEffect(() => {
    const range = ROLE_POINT_RANGES[gradingRole];
    if (range) {
      if (reqGradeValue < range.min || reqGradeValue > range.max) {
        setReqGradeValue(range.min);
      }
    }
  }, [gradingRole]);

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

  // Fetch volunteers list on mount
  useEffect(() => {
    async function loadVolunteers() {
      setVolunteersLoading(true);
      setVolunteersError(null);
      try {
        const list = await listVolunteers(qEventId || undefined);
        setVolunteers(list);
      } catch (err) {
        setVolunteersError(err instanceof Error ? err.message : "Failed to fetch volunteers list.");
      } finally {
        setVolunteersLoading(false);
      }
    }
    loadVolunteers();
  }, [qEventId]);

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

  // Fetch points for a user
  const fetchPointsForUser = async (targetUserId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scoring/volunteers/${targetUserId}/points`);
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

  // Fetch detailed grade reviews for admin
  const fetchDetailedReviews = async () => {
    if (derivedRole !== "Admin") return;
    setReviewsLoading(true);
    setError(null);
    try {
      const reviews = await listDetailedReviews();
      setDetailedReviews(reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grade reviews.");
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (currentTab === "leaderboard") {
        await fetchLeaderboard();
      } else if (currentTab === "point-ledger") {
        const targetId = derivedRole === "Admin" ? selectedVolPointsId || user.authUser.id : user.authUser.id;
        await fetchPointsForUser(targetId);
      } else if (currentTab === "grade-requests") {
        await fetchGradeRequests();
      } else if (currentTab === "grade-reviews") {
        await fetchDetailedReviews();
      }
    };
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, filterTerm, filterYear, filterMonth, selectedVolPointsId]);

  // Form submission helpers

  const handleDeleteRequest = async (requestId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/scoring/grade-requests/${requestId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccess("Grade request deleted/rejected successfully.");
      await fetchGradeRequests();
      if (derivedRole === "Admin") {
        await fetchDetailedReviews();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete request.");
    }
  };





  const hasSelected = !!qEventId && !!qRole;

  if (!hasSelected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader className="text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary mb-4">
              <Trophy className="size-6" />
            </span>
            <CardTitle className="text-2xl font-bold">Select Event & View Mode</CardTitle>
            <CardDescription className="text-sm">
              Please select the event responsibility and role you want to view the scoring dashboard as.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {user.isAdmin ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const targetEvent = showCustomEvent ? customEventId : adminSelEvent;
                  if (targetEvent) {
                    router.push(`/scoring?eventId=${encodeURIComponent(targetEvent)}&role=${encodeURIComponent(adminSelRole)}`);
                  }
                }}
                className="space-y-4"
              >
                <div className="bg-surface-muted p-4 rounded-lg border border-border/50 text-xs text-text-secondary space-y-1">
                  <span className="font-semibold text-text-primary uppercase block mb-1">Administrator Access</span>
                  You have full privileges. You can view scoring for any event and simulate roles.
                </div>

                {!showCustomEvent && allEvents.length > 0 ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Choose Active Event
                    </label>
                    <select
                      value={adminSelEvent}
                      onChange={(e) => setAdminSelEvent(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                    >
                      {allEvents.map((ev) => (
                        <option key={ev.eventId} value={ev.eventId}>
                          {ev.eventTitle} ({ev.eventId})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCustomEvent(true)}
                      className="text-xs text-primary underline mt-1 block"
                    >
                      Or enter custom Event ID manually
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Event ID / Reference
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Open Week"
                      value={customEventId}
                      onChange={(e) => setCustomEventId(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                    />
                    {!showCustomEvent && allEvents.length === 0 && (
                      <span className="text-[10px] text-text-muted mt-1 block">
                        No active event role assignments found in database. Please enter Event ID manually.
                      </span>
                    )}
                    {allEvents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCustomEvent(false)}
                        className="text-xs text-primary underline mt-1 block"
                      >
                        Switch back to active events list
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Select Role / View Mode
                  </label>
                  <select
                    value={adminSelRole}
                    onChange={(e) => setAdminSelRole(e.target.value as "Admin" | "Chairperson" | "Member")}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Chairperson">Chairperson (Chair)</option>
                    <option value="Member">Member (Volunteer)</option>
                  </select>
                </div>

                <Button type="submit" className="w-full">
                  Access Dashboard
                </Button>
              </form>
            ) : user.eventRoles && user.eventRoles.filter((r) => r.active).length > 0 ? (
              <div className="space-y-3">
                <span className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                  Your Event Responsibilities
                </span>
                <div className="grid gap-3">
                  {user.eventRoles
                    .filter((r) => r.active)
                    .map((assignment) => {
                      const displayRole = assignment.role === "Chair" ? "Chairperson" : "Member";
                      return (
                        <button
                          key={assignment.$id}
                          onClick={() => {
                            router.push(`/scoring?eventId=${encodeURIComponent(assignment.eventId)}&role=${encodeURIComponent(displayRole)}`);
                          }}
                          className="flex items-center justify-between p-4 border border-border hover:border-primary/50 hover:bg-primary-soft/5 rounded-lg text-left transition-all group animate-fade-in"
                        >
                          <div>
                            <span className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                              {assignment.eventTitle}
                            </span>
                            <span className="text-xs text-text-muted block mt-0.5">
                              ID: {assignment.eventId}
                            </span>
                          </div>
                          <Badge tone={assignment.role === "Chair" ? "warning" : "neutral"}>
                            {assignment.role}
                          </Badge>
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-4">
                <p className="text-sm text-text-secondary">
                  No active event responsibilities are currently assigned to this account.
                </p>
                <div className="bg-surface-muted p-4 rounded-lg border border-border/50 text-xs text-text-secondary">
                  Please ask an administrator to assign a responsibility in Access Control.
                </div>
                <Link href="/dashboard" className="text-xs text-primary hover:underline block">
                  Back to Access Overview
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header with Role Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-surface p-4 rounded-lg border border-border gap-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-text-primary text-sm uppercase tracking-wider">Dashboard View Mode:</span>
          <Badge tone={derivedRole === "Admin" ? "primary" : derivedRole === "Chairperson" ? "warning" : "neutral"}>
            {derivedRole}
          </Badge>
          {qEventId && (
            <Badge tone="neutral">
              Event: {qEventId}
            </Badge>
          )}
          <Link
            href="/scoring"
            className="text-xs text-primary hover:underline ml-2 flex items-center gap-1 font-medium border-l border-border pl-3"
          >
            Switch Event/Role
          </Link>
        </div>
        <div className="text-xs text-text-secondary">
          Logged in as: <span className="font-semibold">{user.authUser.name}</span> ({user.authUser.email})
        </div>
      </div>

      {/* Tab bar header */}
      <div className="flex border-b border-border bg-surface px-4 py-2 rounded-t-lg gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => startTransition(() => setActiveTab(tab.id))}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-primary-soft text-primary border border-primary/20"
                  : "text-text-secondary hover:bg-surface-muted"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
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
      {currentTab === "leaderboard" && (
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
                <select
                  value={filterTerm}
                  onChange={(e) => setFilterTerm(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm w-36 bg-surface"
                >
                  <option value="2025">2025</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026">2026</option>
                  <option value="2026/2027">2026/2027</option>
                  <option value="2027">2027</option>
                  <option value="2027/2028">2027/2028</option>
                  <option value="2028">2028</option>
                  <option value="2028/2029">2028/2029</option>
                </select>
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

      {currentTab === "point-ledger" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>{derivedRole === "Admin" ? "Point Ledger (Admin View)" : "My Point Ledger"}</CardTitle>
                <CardDescription>
                  {derivedRole === "Admin"
                    ? "Inspect any volunteer's accumulated points ledger."
                    : "Your total accumulated points on the volunteer management platform."}
                </CardDescription>
              </div>
              
              {derivedRole === "Admin" && (
                <div className="w-64 space-y-1">
                  <label className="block text-xs font-semibold uppercase text-text-secondary">
                    Inspect Volunteer
                  </label>
                  <VolunteerSelect
                    value={selectedVolPointsId}
                    onChange={(val) => setSelectedVolPointsId(val)}
                    volunteers={volunteers}
                    loading={volunteersLoading}
                    error={volunteersError}
                  />
                </div>
              )}

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
                {derivedRole === "Admin"
                  ? "This volunteer has not received any points yet."
                  : "You have not received any points yet. Participate in events and get graded to accumulate points!"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {currentTab === "grade-requests" && (
        <div className="space-y-6">
          {(derivedRole === "Admin" || derivedRole === "Chairperson") && (
            <Card>
              <CardHeader>
                <CardTitle>Submit Grade Request</CardTitle>
                <CardDescription>
                  Initiate a grading workflow for a volunteer participating in an event.
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
                      setReqEventId("");
                      setReqTargetUserId("");
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
                      disabled={derivedRole === "Chairperson" && !!qEventId}
                      value={reqEventId}
                      onChange={(e) => setReqEventId(e.target.value)}
                      placeholder="e.g. MoraForesight 4.0"
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Volunteer User
                    </label>
                    <VolunteerSelect
                      value={reqTargetUserId}
                      onChange={(val) => setReqTargetUserId(val)}
                      volunteers={volunteers.filter((v) => v.id !== user.authUser.id)}
                      loading={volunteersLoading}
                      error={volunteersError}
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                        Points ({gradingRole})
                      </label>
                      <input
                        type="number"
                        min={ROLE_POINT_RANGES[gradingRole]?.min ?? 10}
                        max={ROLE_POINT_RANGES[gradingRole]?.max ?? 70}
                        required
                        value={reqGradeValue}
                        onChange={(e) => setReqGradeValue(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                      />
                      <span className="text-[10px] text-text-muted mt-1 block">
                        Allowed range: {ROLE_POINT_RANGES[gradingRole]?.min ?? 10} - {ROLE_POINT_RANGES[gradingRole]?.max ?? 70} points
                      </span>
                    </div>
                    <Button type="submit" className="shrink-0 flex items-center gap-1 mt-5">
                      <Plus className="size-4" /> Submit
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {derivedRole === "Admin"
                  ? "All Grading Requests"
                  : qEventId
                  ? `Grading Requests for ${qEventId}`
                  : "Grading Requests for My Events"}
              </CardTitle>
              <CardDescription>
                {derivedRole === "Admin"
                  ? "Manage and inspect the status of all active volunteer grading workflows."
                  : "List of grading requests for events you chair."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const chairEventIds = user.eventRoles
                  .filter((r) => r.active && r.role === "Chair")
                  .map((r) => r.eventId);

                const visibleRequests = derivedRole === "Admin"
                  ? (qEventId ? gradeRequests.filter(req => req.eventId === qEventId) : gradeRequests)
                  : gradeRequests.filter((req) => {
                      if (qEventId) {
                        return req.eventId === qEventId;
                      }
                      return chairEventIds.includes(req.eventId);
                    });

                if (visibleRequests.length > 0) {
                  return (
                    <div className="space-y-4">
                      {visibleRequests.map((req) => {
                        const targetVolName = volunteers.find((v) => v.id === req.targetUserId)?.name || req.targetUserId;
                        const isChairedByMe = chairEventIds.includes(req.eventId);

                        return (
                          <div
                            key={req.$id}
                            className="p-4 border border-border rounded-lg bg-surface flex flex-col gap-4"
                          >
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
                                  Volunteer: <span className="font-semibold">{targetVolName}</span> | Requested by: {req.requestedBy}
                                </p>
                              </div>

                              {/* Actions for Admin only */}
                              {derivedRole === "Admin" && req.status !== "finalized" && (
                                <div className="flex gap-2">
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
                                    Approve (Finalize)
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    onClick={() => handleDeleteRequest(req.$id)}
                                  >
                                    Reject (Delete)
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Warning & disabled inputs if Chairperson of event */}
                            {derivedRole === "Chairperson" && isChairedByMe && (
                              <div className="space-y-3">
                                <div className="p-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md font-medium">
                                  You are the chair of this event and cannot submit a grade review for it.
                                </div>
                                <div className="flex flex-wrap gap-2 items-center opacity-50 pointer-events-none">
                                  <input
                                    type="number"
                                    placeholder="Grade"
                                    disabled
                                    className="w-16 px-2 py-1 border border-border rounded text-sm bg-surface"
                                  />
                                  <Button variant="secondary" disabled>
                                    Submit Review
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                } else {
                  return <p className="text-center py-6 text-text-secondary">No grading requests found.</p>;
                }
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {currentTab === "grade-reviews" && derivedRole === "Admin" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submit Grade Review</CardTitle>
              <CardDescription>
                Submit or update a grade review for an open request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  setSuccess(null);
                  try {
                    const res = await fetch(`/api/scoring/grade-requests/${revRequestId}`, {
                      method: "PATCH",
                      body: JSON.stringify({ gradeValue: revGradeValue }),
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    setSuccess("Grade review submitted!");
                    fetchGradeRequests();
                    await fetchDetailedReviews();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to submit review.");
                  }
                }}
                className="grid gap-4 md:grid-cols-3 items-end"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Select Open Request
                  </label>
                  <select
                    required
                    value={revRequestId}
                    onChange={(e) => setRevRequestId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  >
                    <option value="">-- Choose Request --</option>
                    {gradeRequests
                      .filter((r) => r.status !== "finalized")
                      .map((r) => {
                        const targetName = volunteers.find((v) => v.id === r.targetUserId)?.name || r.targetUserId;
                        return (
                          <option key={r.$id} value={r.$id}>
                            {r.eventId} - {targetName}
                          </option>
                        );
                      })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Grade Value (0-10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    required
                    value={revGradeValue}
                    onChange={(e) => setRevGradeValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Submit Review
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Grade Reviews Log</CardTitle>
              <CardDescription>
                Audit history of all reviewer grade contributions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <div className="text-center py-6 text-text-secondary">Loading reviews...</div>
              ) : detailedReviews.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-left text-sm">
                    <thead className="text-text-secondary">
                      <tr>
                        <th className="py-2 pr-4 font-semibold">Event</th>
                        <th className="px-4 py-2 font-semibold">Volunteer Name</th>
                        <th className="px-4 py-2 font-semibold">Reviewer</th>
                        <th className="px-4 py-2 font-semibold text-center">Grade</th>
                        <th className="px-4 py-2 font-semibold">Submitted At</th>
                        <th className="px-4 py-2 font-semibold">Audit Overrides</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailedReviews.map((rev) => {
                        let auditHistory: string[] = [];
                        if (rev.audit_metadata) {
                          try {
                            const parsed = JSON.parse(rev.audit_metadata);
                            if (Array.isArray(parsed)) {
                              auditHistory = parsed.map(
                                (entry: GradeAuditEntry) =>
                                  `Changed from ${entry.originalValue} to ${entry.newValue} by ${entry.changedBy} on ${new Date(entry.changedAt).toLocaleDateString()} (Reason: ${entry.reason || "None"})`
                              );
                            }
                          } catch {}
                        }

                        return (
                          <tr key={rev.$id}>
                            <td className="py-3 pr-4 font-medium text-text-primary">{rev.eventId}</td>
                            <td className="px-4 py-3 text-text-primary">{rev.volunteerName}</td>
                            <td className="px-4 py-3 text-text-secondary">{rev.reviewerName}</td>
                            <td className="px-4 py-3 text-center font-bold text-text-primary">{rev.gradeValue} / 10</td>
                            <td className="px-4 py-3 text-text-secondary">
                              {new Date(rev.submittedAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-xs text-text-muted">
                              {auditHistory.length > 0 ? (
                                <ul className="list-disc pl-4 space-y-0.5">
                                  {auditHistory.map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                "No overrides"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-6 text-text-secondary">No reviews found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentTab === "finalize-grades" && derivedRole === "Admin" && (
        <Card>
          <CardHeader>
            <CardTitle>Finalize Grades</CardTitle>
            <CardDescription>
              Averages reviews and assigns final points ledger entries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {gradeRequests.filter((r) => r.status !== "finalized").length > 0 ? (
              <div className="space-y-4">
                {gradeRequests
                  .filter((r) => r.status !== "finalized")
                  .map((req) => {
                    const targetName = volunteers.find((v) => v.id === req.targetUserId)?.name || req.targetUserId;
                    return (
                      <div
                        key={req.$id}
                        className="p-4 border border-border rounded-lg bg-surface flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                      >
                        <div>
                          <p className="font-semibold text-sm text-text-primary">{req.eventId}</p>
                          <p className="text-xs text-text-secondary">
                            Volunteer: <span className="font-semibold">{targetName}</span> | Current Status: <span className="font-mono">{req.status}</span>
                          </p>
                        </div>
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
                          Finalize Grade
                        </Button>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-center py-6 text-text-secondary">No requests ready to finalize.</p>
            )}
          </CardContent>
        </Card>
      )}



      {currentTab === "admin-tools" && derivedRole === "Admin" && (
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
                    setOverReviewId("");
                    setOverReason("");
                    await fetchDetailedReviews();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Override failed.");
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Select Grade Review
                  </label>
                  <select
                    required
                    value={overReviewId}
                    onChange={(e) => {
                      setOverReviewId(e.target.value);
                      const rev = detailedReviews.find((r) => r.$id === e.target.value);
                      if (rev) {
                        setOverGradeValue(rev.gradeValue);
                      }
                    }}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  >
                    <option value="">-- Choose Review to Override --</option>
                    {detailedReviews.map((rev) => (
                      <option key={rev.$id} value={rev.$id}>
                        {rev.eventId} - {rev.volunteerName} (Reviewer: {rev.reviewerName}, Score: {rev.gradeValue})
                      </option>
                    ))}
                  </select>
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
                    setExUserId("");
                    setExReason("");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to update exclusion.");
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Select Volunteer
                  </label>
                  <VolunteerSelect
                    value={exUserId}
                    onChange={(val) => setExUserId(val)}
                    volunteers={volunteers}
                    loading={volunteersLoading}
                    error={volunteersError}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Term
                    </label>
                    <select
                      value={exTerm}
                      onChange={(e) => setExTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                    >
                      <option value="2025">2025</option>
                      <option value="2025/2026">2025/2026</option>
                      <option value="2026">2026</option>
                      <option value="2026/2027">2026/2027</option>
                      <option value="2027">2027</option>
                      <option value="2027/2028">2027/2028</option>
                      <option value="2028">2028</option>
                      <option value="2028/2029">2028/2029</option>
                    </select>
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
