import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  formatHM,
  toDateString,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  formatMonth,
  formatDateRange,
  isSameDay,
} from "@/lib/date-utils";
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import { TimesheetTable } from "@/components/timesheet-table";
import type { TimesheetResult } from "@/lib/timesheet-types";

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const SLOT_BORDER_COLORS = [
  "border-blue-500",
  "border-green-500",
  "border-purple-500",
  "border-orange-500",
  "border-pink-500",
  "border-teal-500",
];

const SLOT_BG_LIGHT = [
  "bg-blue-50 dark:bg-blue-950/30",
  "bg-green-50 dark:bg-green-950/30",
  "bg-purple-50 dark:bg-purple-950/30",
  "bg-orange-50 dark:bg-orange-950/30",
  "bg-pink-50 dark:bg-pink-950/30",
  "bg-teal-50 dark:bg-teal-950/30",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkItemWithProject {
  id: string;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
  project: { id: string; name: string; slug: string };
}

type TabKey = "timesheet" | "workitems";
type PeriodKey = "day" | "week" | "month";

/** Compute the [from, to) date range (to is exclusive) for a period anchor. */
function periodRange(period: PeriodKey, date: Date): { from: Date; to: Date } {
  if (period === "day") {
    const from = new Date(date);
    from.setHours(0, 0, 0, 0);
    return { from, to: addDays(from, 1) };
  }
  if (period === "week") {
    return { from: startOfWeek(date), to: endOfWeek(date) };
  }
  return { from: startOfMonth(date), to: endOfMonth(date) };
}

/** Human-readable label for the selected period. */
function periodLabel(period: PeriodKey, date: Date): string {
  if (period === "day") {
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  if (period === "week") {
    return formatDateRange(startOfWeek(date), endOfWeek(date));
  }
  return formatMonth(date);
}

function formatDuration(start: string, end: string | null): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const mins = Math.floor((e - s) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OrgMemberViewPage() {
  const { orgId, memberId } = useParams<{
    orgId: string;
    memberId: string;
  }>();
  const navigate = useNavigate();

  const [memberName, setMemberName] = useState("");
  const [timesheet, setTimesheet] = useState<TimesheetResult | null>(null);
  const [workItems, setWorkItems] = useState<WorkItemWithProject[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [activeTab, setActiveTab] = useState<TabKey>("timesheet");
  const [loading, setLoading] = useState(true);

  const rangeLabel = periodLabel(period, selectedDate);
  const isToday = isSameDay(selectedDate, new Date());
  const totalLabel =
    period === "day"
      ? "Daily Total"
      : period === "week"
        ? "Weekly Total"
        : "Monthly Total";

  function navigateDate(direction: -1 | 1) {
    setSelectedDate((prev) => {
      if (period === "month") {
        const next = new Date(prev);
        next.setMonth(next.getMonth() + direction);
        return next;
      }
      if (period === "week") {
        return addDays(prev, direction * 7);
      }
      return addDays(prev, direction);
    });
  }

  const loadData = useCallback(
    async (date: Date, activePeriod: PeriodKey) => {
      if (!orgId || !memberId) return;
      setLoading(true);
      try {
        const { from: fromDate, to: toDate } = periodRange(activePeriod, date);
        const from = toDateString(fromDate);
        const to = toDateString(toDate);
        const [ts, items, members] = await Promise.all([
          api.get(
            `/organisations/${orgId}/members/${memberId}/timesheet?from=${from}&to=${to}`
          ),
          api.get(
            `/organisations/${orgId}/members/${memberId}/work-items?from=${from}&to=${to}`
          ),
          api.get(`/organisations/${orgId}/members`),
        ]);
        setTimesheet(ts);
        setWorkItems(items);

        const member = members.find(
          (m: { userId: string; user: { name: string } }) =>
            m.userId === memberId
        );
        if (member) setMemberName(member.user.name);
      } catch {
        setTimesheet(null);
        setWorkItems([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId, memberId]
  );

  useEffect(() => {
    loadData(selectedDate, period);
  }, [selectedDate, period, loadData]);

  // Derive per-project breakdown from timesheet entries
  const byProject = useMemo(() => {
    if (!timesheet) return [];
    const map = new Map<
      string,
      { projectId: string; projectName: string; totalMins: number }
    >();
    for (const entry of timesheet.entries) {
      const existing = map.get(entry.projectId) || {
        projectId: entry.projectId,
        projectName: entry.projectName,
        totalMins: 0,
      };
      existing.totalMins += entry.effectiveMinutes;
      map.set(entry.projectId, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.totalMins - a.totalMins);
  }, [timesheet]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back button + header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-muted-foreground"
            onClick={() => navigate(`/organisation/${orgId}/report`)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Report
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {memberName ? `${memberName}'s Timesheet` : "Member Timesheet"}
            </h1>
            <Badge variant="secondary">Read Only</Badge>
          </div>
        </div>

        {/* Period label */}
        <h2 className="text-lg font-semibold mb-3">{rangeLabel}</h2>

        {/* Date navigation */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigateDate(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="relative">
            <input
              type="date"
              value={toDateString(selectedDate)}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(new Date(e.target.value + "T00:00:00"));
                }
              }}
              className="bg-background border border-border rounded-md px-3 py-1.5 text-sm h-9 cursor-pointer"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigateDate(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => setSelectedDate(new Date())}
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Today
            </Button>
          )}
        </div>

        {/* Period Switcher (Day / Week / Month) */}
        <div className="flex gap-1 mb-3 bg-muted rounded-lg p-1">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* View Switcher */}
        <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1">
          {(
            [
              { key: "timesheet", label: "Timesheet" },
              { key: "workitems", label: "Work Items" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Loading...
          </p>
        ) : (
          <>
            {/* TIMESHEET TAB */}
            {activeTab === "timesheet" && (
              <>
                {timesheet ? (
                  <>
                    {byProject.length > 1 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                        {byProject.map(({ projectId, projectName, totalMins }, idx) => {
                          const ci = idx % SLOT_BORDER_COLORS.length;
                          const md = (
                            totalMins /
                            60 /
                            timesheet.hoursPerManDay
                          ).toFixed(1);
                          return (
                            <Card
                              key={projectId}
                              className={`${SLOT_BG_LIGHT[ci]} border-l-4 ${SLOT_BORDER_COLORS[ci]}`}
                            >
                              <CardContent className="py-4 px-4">
                                <div className="text-sm font-medium text-muted-foreground truncate">
                                  {projectName}
                                </div>
                                <div className="text-xl font-bold mt-1">
                                  {formatHM(totalMins)}{" "}
                                  <span className="text-muted-foreground font-normal text-xs">
                                    ({md} MD)
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                    <TimesheetTable
                      timesheet={timesheet}
                      showProject={byProject.length > 1}
                      totalLabel={totalLabel}
                    />
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No work logged in {rangeLabel}
                  </p>
                )}
              </>
            )}

            {/* WORK ITEMS TAB */}
            {activeTab === "workitems" && (
              <>
                {workItems.length === 0 ? (
                  <Card>
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      No work items in {rangeLabel}
                    </div>
                  </Card>
                ) : (
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-muted-foreground">
                              {new Date(item.startedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {item.project.name}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatTime(item.startedAt)}
                            </TableCell>
                            <TableCell>
                              {item.endedAt ? (
                                <span className="font-mono text-sm">
                                  {formatTime(item.endedAt)}
                                </span>
                              ) : (
                                <Badge>Active</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatDuration(item.startedAt, item.endedAt)}
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-[300px] truncate">
                              {item.description || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
