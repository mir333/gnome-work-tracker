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
  startOfMonth,
  endOfMonth,
  formatMonth,
  shortDayName,
} from "@/lib/date-utils";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface WorkItemWithProject {
  id: string;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
  project: { id: string; name: string; slug: string };
}

interface DayRow {
  date: string;
  dayName: string;
  entries: {
    project: string;
    totalMins: number;
    descriptions: string[];
  }[];
  totalMins: number;
}

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
// Aggregation helpers
// ---------------------------------------------------------------------------

function aggregateByProject(items: WorkItemWithProject[]) {
  const map = new Map<
    string,
    { project: Project; totalMins: number }
  >();
  for (const item of items) {
    const entry = map.get(item.project.id) || {
      project: item.project,
      totalMins: 0,
    };
    const s = new Date(item.startedAt).getTime();
    const e = item.endedAt ? new Date(item.endedAt).getTime() : Date.now();
    entry.totalMins += Math.max(0, Math.floor((e - s) / 60000));
    map.set(item.project.id, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.totalMins - a.totalMins);
}

function aggregateByDay(items: WorkItemWithProject[]): DayRow[] {
  const dayMap = new Map<
    string,
    Map<string, { projectName: string; totalMins: number; descriptions: string[] }>
  >();

  for (const item of items) {
    const dateStr = toDateString(new Date(item.startedAt));
    const s = new Date(item.startedAt).getTime();
    const e = item.endedAt ? new Date(item.endedAt).getTime() : Date.now();
    const mins = Math.max(0, Math.floor((e - s) / 60000));

    if (!dayMap.has(dateStr)) dayMap.set(dateStr, new Map());
    const projects = dayMap.get(dateStr)!;

    const projEntry = projects.get(item.project.id) || {
      projectName: item.project.name,
      totalMins: 0,
      descriptions: [],
    };
    projEntry.totalMins += mins;
    if (item.description) {
      projEntry.descriptions.push(item.description);
    }
    projects.set(item.project.id, projEntry);
  }

  const rows: DayRow[] = [];
  for (const [dateStr, projects] of dayMap) {
    const d = new Date(dateStr + "T00:00:00");
    const entries = Array.from(projects.values()).map((p) => ({
      project: p.projectName,
      totalMins: p.totalMins,
      descriptions: p.descriptions,
    }));
    const totalMins = entries.reduce((sum, e) => sum + e.totalMins, 0);
    rows.push({
      date: dateStr,
      dayName: shortDayName(d),
      entries,
      totalMins,
    });
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date));
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
  const [workItems, setWorkItems] = useState<WorkItemWithProject[]>([]);
  const [hoursPerManDay, setHoursPerManDay] = useState(8);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const monthLabel = formatMonth(selectedMonth);

  function navigateMonth(direction: -1 | 1) {
    setSelectedMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + direction);
      return next;
    });
  }

  const loadData = useCallback(
    async (date: Date) => {
      if (!orgId || !memberId) return;
      setLoading(true);
      try {
        const ms = startOfMonth(date);
        const me = endOfMonth(date);
        const [items, settings, members] = await Promise.all([
          api.get(
            `/organisations/${orgId}/members/${memberId}/work-items?from=${toDateString(ms)}&to=${toDateString(me)}`
          ),
          api.get("/profile/settings"),
          api.get(`/organisations/${orgId}/members`),
        ]);
        setWorkItems(items);
        setHoursPerManDay(settings.hoursPerManDay);

        // Find member name
        const member = members.find(
          (m: { userId: string; user: { name: string } }) =>
            m.userId === memberId
        );
        if (member) setMemberName(member.user.name);
      } catch {
        setWorkItems([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId, memberId]
  );

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth, loadData]);

  // Aggregations
  const byProject = useMemo(
    () => aggregateByProject(workItems),
    [workItems]
  );
  const byDay = useMemo(() => aggregateByDay(workItems), [workItems]);

  const monthTotal = useMemo(
    () => byProject.reduce((sum, p) => sum + p.totalMins, 0),
    [byProject]
  );

  const manDays = (monthTotal / 60 / hoursPerManDay).toFixed(1);

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

        {/* Month navigation */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigateMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {monthLabel}
          </h2>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigateMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Loading...
          </p>
        ) : (
          <>
            {/* Monthly total card */}
            <Card className="mb-4">
              <div className="px-6 py-4 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Monthly Total
                </span>
                <span className="text-lg font-semibold">
                  {formatHM(monthTotal)}{" "}
                  <span className="text-muted-foreground font-normal text-sm">
                    ({manDays} MD)
                  </span>
                </span>
              </div>
            </Card>

            {/* Per-project breakdown cards */}
            {byProject.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {byProject.map(({ project, totalMins }, idx) => {
                  const ci = idx % SLOT_BORDER_COLORS.length;
                  const md = (totalMins / 60 / hoursPerManDay).toFixed(1);
                  return (
                    <Card
                      key={project.id}
                      className={`${SLOT_BG_LIGHT[ci]} border-l-4 ${SLOT_BORDER_COLORS[ci]}`}
                    >
                      <CardContent className="py-4 px-4">
                        <div className="text-sm font-medium text-muted-foreground truncate">
                          {project.name}
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

            {/* Daily timesheet table */}
            {byDay.length > 0 ? (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byDay.map((row) =>
                      row.entries.map((entry, entryIdx) => (
                        <TableRow key={`${row.date}-${entryIdx}`}>
                          {entryIdx === 0 ? (
                            <>
                              <TableCell
                                rowSpan={row.entries.length}
                                className="font-medium align-top"
                              >
                                {row.date}
                              </TableCell>
                              <TableCell
                                rowSpan={row.entries.length}
                                className="text-muted-foreground align-top"
                              >
                                {row.dayName}
                              </TableCell>
                            </>
                          ) : null}
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {entry.project}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatHM(entry.totalMins)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                            {entry.descriptions.join("; ") || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {/* Monthly total row */}
                    <TableRow className="font-semibold border-t-2">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="font-mono">
                        {formatHM(monthTotal)}
                      </TableCell>
                      <TableCell>{manDays} MD</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                No work logged in {monthLabel}
              </p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
