import { useEffect, useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  formatHM,
  toDateString,
  isSameDay,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  formatDateRange,
  formatMonth,
  shortDayName,
} from "@/lib/date-utils";
import { Clock, ChevronLeft, ChevronRight, Calendar, Trash2, Pencil } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface DashboardSlot {
  slot: number;
  projectId: string;
  project: Project;
}

interface WorkItemWithProject {
  id: string;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
  project: { id: string; name: string; slug: string };
}

type TabKey = "day" | "week" | "month";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLOT_COLORS = [
  "bg-blue-500 hover:bg-blue-600",
  "bg-green-500 hover:bg-green-600",
  "bg-purple-500 hover:bg-purple-600",
  "bg-orange-500 hover:bg-orange-600",
  "bg-pink-500 hover:bg-pink-600",
  "bg-teal-500 hover:bg-teal-600",
];

const SLOT_BORDER_COLORS = [
  "border-blue-500",
  "border-green-500",
  "border-purple-500",
  "border-orange-500",
  "border-pink-500",
  "border-teal-500",
];

const CHART_COLORS = [
  "#3b82f6", // blue-500
  "#22c55e", // green-500
  "#a855f7", // purple-500
  "#f97316", // orange-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
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
// Helpers
// ---------------------------------------------------------------------------

interface ProjectAgg {
  project: { id: string; name: string; slug: string };
  totalMins: number;
}

function aggregateByProject(items: WorkItemWithProject[]): ProjectAgg[] {
  const map = new Map<string, ProjectAgg>();
  for (const item of items) {
    const start = new Date(item.startedAt).getTime();
    const end = item.endedAt ? new Date(item.endedAt).getTime() : Date.now();
    const mins = Math.max(0, Math.floor((end - start) / 60000));
    const existing = map.get(item.project.id);
    if (existing) {
      existing.totalMins += mins;
    } else {
      map.set(item.project.id, { project: item.project, totalMins: mins });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalMins - a.totalMins);
}

function totalMinutes(items: WorkItemWithProject[]): number {
  return items.reduce((acc, item) => {
    const start = new Date(item.startedAt).getTime();
    const end = item.endedAt ? new Date(item.endedAt).getTime() : Date.now();
    return acc + Math.max(0, Math.floor((end - start) / 60000));
  }, 0);
}

function getColorIndex(
  projectId: string,
  colorMap: Record<string, number>
): number {
  return colorMap[projectId] ?? 0;
}

// ---------------------------------------------------------------------------
// Component: Project Summary Cards
// ---------------------------------------------------------------------------

function ProjectSummaryCards({
  items,
  colorMap,
  hoursPerManDay,
}: {
  items: WorkItemWithProject[];
  colorMap: Record<string, number>;
  hoursPerManDay: number;
}) {
  const byProject = aggregateByProject(items);

  if (byProject.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {byProject.map(({ project, totalMins }) => {
        const ci = getColorIndex(project.id, colorMap);
        const manDays = (totalMins / 60 / hoursPerManDay).toFixed(1);
        return (
          <Card
            key={project.id}
            className={`${SLOT_BG_LIGHT[ci]} border-l-4 ${SLOT_BORDER_COLORS[ci]}`}
          >
            <CardContent className="py-4 px-4">
              <div className="text-sm font-medium text-muted-foreground">
                {project.name}
              </div>
              <div className="text-2xl font-bold mt-1">
                {formatHM(totalMins)}{" "}
                <span className="text-muted-foreground font-normal text-sm">
                  ({manDays} MD)
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component: Donut Chart
// ---------------------------------------------------------------------------

function ProjectDonutChart({
  items,
  colorMap,
}: {
  items: WorkItemWithProject[];
  colorMap: Record<string, number>;
}) {
  const byProject = aggregateByProject(items);
  if (byProject.length === 0) return null;

  const data = byProject.map(({ project, totalMins }) => ({
    name: project.name,
    value: totalMins,
    color: CHART_COLORS[getColorIndex(project.id, colorMap) % CHART_COLORS.length],
  }));

  return (
    <div className="mb-6">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown) => formatHM(Number(value) || 0)}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component: Weekly Stacked Bar Chart
// ---------------------------------------------------------------------------

function WeekBarChart({
  items,
  selectedDate,
  colorMap,
}: {
  items: WorkItemWithProject[];
  selectedDate: Date;
  colorMap: Record<string, number>;
}) {
  const weekStart = startOfWeek(selectedDate);

  // Get unique projects
  const projectsMap = new Map<string, { id: string; name: string }>();
  for (const item of items) {
    if (!projectsMap.has(item.project.id)) {
      projectsMap.set(item.project.id, item.project);
    }
  }
  const projects = Array.from(projectsMap.values());

  // Build chart data: one entry per day
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const dayStr = toDateString(day);
    const entry: Record<string, unknown> = { day: shortDayName(day) };

    for (const proj of projects) {
      const dayItems = items.filter(
        (it) =>
          it.project.id === proj.id &&
          toDateString(new Date(it.startedAt)) === dayStr
      );
      const mins = dayItems.reduce((acc, it) => {
        const start = new Date(it.startedAt).getTime();
        const end = it.endedAt ? new Date(it.endedAt).getTime() : Date.now();
        return acc + Math.max(0, Math.floor((end - start) / 60000));
      }, 0);
      entry[proj.name] = mins;
    }
    return entry;
  });

  if (projects.length === 0) return null;

  return (
    <div className="mb-6">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData}>
          <XAxis dataKey="day" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => (v >= 60 ? `${Math.floor(v / 60)}h` : `${v}m`)}
          />
          <Tooltip
            formatter={(value: unknown) => formatHM(Number(value) || 0)}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
          />
          <Legend />
          {projects.map((proj) => (
            <Bar
              key={proj.id}
              dataKey={proj.name}
              stackId="a"
              fill={CHART_COLORS[getColorIndex(proj.id, colorMap) % CHART_COLORS.length]}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const [slots, setSlots] = useState<DashboardSlot[]>([]);
  const [active, setActive] = useState<WorkItemWithProject | null>(null);
  const [dayItems, setDayItems] = useState<WorkItemWithProject[]>([]);
  const [weekItems, setWeekItems] = useState<WorkItemWithProject[]>([]);
  const [monthItems, setMonthItems] = useState<WorkItemWithProject[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [hoursPerManDay, setHoursPerManDay] = useState(8);
  // Edit entry state
  const [editItem, setEditItem] = useState<WorkItemWithProject | null>(null);
  const [editForm, setEditForm] = useState({
    startedAt: "",
    endedAt: "",
    description: "",
  });
  const [editError, setEditError] = useState<string | null>(null);

  const isToday = isSameDay(selectedDate, new Date());

  // Build color map from dashboard slots
  const colorMap = useMemo(() => {
    const m: Record<string, number> = {};
    slots.forEach((s, i) => {
      m[s.project.id] = i % SLOT_COLORS.length;
    });
    return m;
  }, [slots]);

  // ---- Data loading ----
  const loadSlots = useCallback(async () => {
    const s = await api.get("/dashboard");
    setSlots(s);
  }, []);

  const loadDay = useCallback(async (date: Date) => {
    const dateStr = toDateString(date);
    const today = toDateString(new Date());
    if (dateStr === today) {
      const st = await api.get("/status");
      setActive(st.active);
      setDayItems(st.today);
    } else {
      const st = await api.get(`/status?date=${dateStr}`);
      setActive(st.active);
      setDayItems(st.items ?? []);
    }
  }, []);

  const loadWeek = useCallback(async (date: Date) => {
    const ws = startOfWeek(date);
    const we = endOfWeek(date);
    const st = await api.get(
      `/status?from=${toDateString(ws)}&to=${toDateString(we)}`
    );
    setActive(st.active);
    setWeekItems(st.items ?? []);
  }, []);

  const loadMonth = useCallback(async (date: Date) => {
    const ms = startOfMonth(date);
    const me = endOfMonth(date);
    const st = await api.get(
      `/status?from=${toDateString(ms)}&to=${toDateString(me)}`
    );
    setActive(st.active);
    setMonthItems(st.items ?? []);
  }, []);

  const loadSettings = useCallback(async () => {
    const data = await api.get("/profile/settings");
    setHoursPerManDay(data.hoursPerManDay);
  }, []);

  // Load slots and settings once
  useEffect(() => {
    loadSlots();
    loadSettings();
  }, [loadSlots, loadSettings]);

  // Load data when tab or date changes
  useEffect(() => {
    if (activeTab === "day") loadDay(selectedDate);
    else if (activeTab === "week") loadWeek(selectedDate);
    else loadMonth(selectedDate);
  }, [activeTab, selectedDate, loadDay, loadWeek, loadMonth]);

  // ---- Actions ----
  function reloadCurrentTab() {
    if (activeTab === "day") loadDay(selectedDate);
    else if (activeTab === "week") loadWeek(selectedDate);
    else loadMonth(selectedDate);
  }

  async function handleDeleteItem() {
    if (!deleteItemId) return;
    await api.delete(`/work-items/${deleteItemId}`);
    setDeleteItemId(null);
    reloadCurrentTab();
  }

  function toLocalDatetime(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openEdit(item: WorkItemWithProject) {
    setEditError(null);
    setEditItem(item);
    setEditForm({
      startedAt: toLocalDatetime(item.startedAt),
      endedAt: item.endedAt ? toLocalDatetime(item.endedAt) : "",
      description: item.description || "",
    });
  }

  async function handleEditEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setEditError(null);
    try {
      await api.put(`/work-items/${editItem.id}`, {
        startedAt: new Date(editForm.startedAt).toISOString(),
        endedAt: editForm.endedAt
          ? new Date(editForm.endedAt).toISOString()
          : undefined,
        description: editForm.description,
      });
      setEditItem(null);
      reloadCurrentTab();
    } catch (err: any) {
      setEditError(err.message || "Failed to update entry");
    }
  }

  function navigateDate(direction: -1 | 1) {
    setSelectedDate((prev) => {
      if (activeTab === "month") {
        const next = new Date(prev);
        next.setMonth(next.getMonth() + direction);
        return next;
      }
      if (activeTab === "week") {
        return addDays(prev, direction * 7);
      }
      return addDays(prev, direction);
    });
  }

  // ---- Computed ----
  const currentItems =
    activeTab === "day"
      ? dayItems
      : activeTab === "week"
        ? weekItems
        : monthItems;

  const total = totalMinutes(currentItems);

  // Header label
  const dateLabel =
    activeTab === "day"
      ? selectedDate.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : activeTab === "week"
        ? formatDateRange(startOfWeek(selectedDate), endOfWeek(selectedDate))
        : formatMonth(selectedDate);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{dateLabel}</h1>
          <div className="flex items-center gap-3 mt-2">
            {active ? (
              <Badge variant="default" className="text-sm py-1 px-3">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
                Working on {active.project.name}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-sm py-1 px-3">
                Not tracking
              </Badge>
            )}
            {total > 0 && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatHM(total)}{" "}
                {activeTab === "day"
                  ? "today"
                  : activeTab === "week"
                    ? "this week"
                    : "this month"}
              </span>
            )}
          </div>
        </div>

        {/* Day Navigation */}
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

        {/* Tab Switcher */}
        <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1">
          {(["day", "week", "month"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ================================================================ */}
        {/* DAY VIEW                                                         */}
        {/* ================================================================ */}
        {activeTab === "day" && (
          <>
            {/* Per-project aggregation cards */}
            <ProjectSummaryCards items={dayItems} colorMap={colorMap} hoursPerManDay={hoursPerManDay} />

            {/* Donut chart */}
            <ProjectDonutChart items={dayItems} colorMap={colorMap} />

            {/* Timeline */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Timeline</h2>
              <div className="space-y-1.5">
                {dayItems.map((item) => {
                  const start = new Date(item.startedAt);
                  const end = item.endedAt
                    ? new Date(item.endedAt)
                    : new Date();
                  const mins = Math.max(
                    0,
                    Math.floor((end.getTime() - start.getTime()) / 60000)
                  );
                  const colorIdx = getColorIndex(item.project.id, colorMap);
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-12 text-right font-mono">
                        {start.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <div
                        className={`flex-1 rounded-md px-3 py-2 text-sm cursor-pointer transition-all hover:opacity-80 border-l-4 bg-card ${SLOT_BORDER_COLORS[colorIdx]}`}
                        onClick={() => openEdit(item)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {item.project.name}
                          </span>
                          <span className="text-muted-foreground text-xs flex items-center gap-1">
                            {formatHM(mins)}
                            {!item.endedAt && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            )}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(item);
                        }}
                        title="Edit entry"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteItemId(item.id);
                        }}
                        title="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
                {dayItems.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    No work logged{isToday ? " today" : " on this day"}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ================================================================ */}
        {/* WEEK VIEW                                                        */}
        {/* ================================================================ */}
        {activeTab === "week" && (
          <>
            {/* Per-project aggregation cards */}
            <ProjectSummaryCards items={weekItems} colorMap={colorMap} hoursPerManDay={hoursPerManDay} />

            {/* Stacked bar chart */}
            <WeekBarChart
              items={weekItems}
              selectedDate={selectedDate}
              colorMap={colorMap}
            />

            {/* Daily breakdown list */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Daily Breakdown</h2>
              <div className="space-y-3">
                {Array.from({ length: 7 }, (_, i) => {
                  const day = addDays(startOfWeek(selectedDate), i);
                  const dayStr = toDateString(day);
                  const dayItemsList = weekItems.filter(
                    (it) => toDateString(new Date(it.startedAt)) === dayStr
                  );
                  const dayTotal = totalMinutes(dayItemsList);
                  const isCurrentDay = isSameDay(day, new Date());

                  return (
                    <div
                      key={dayStr}
                      className={`rounded-lg border px-4 py-3 ${
                        isCurrentDay
                          ? "border-primary/30 bg-primary/5"
                          : "bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {day.toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          {isCurrentDay && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Today
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-semibold">
                          {dayTotal > 0 ? formatHM(dayTotal) : "—"}
                        </span>
                      </div>
                      {dayItemsList.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {aggregateByProject(dayItemsList).map(
                            ({ project, totalMins: projMins }) => {
                              const ci = getColorIndex(
                                project.id,
                                colorMap
                              );
                              return (
                                <span
                                  key={project.id}
                                  className={`text-xs px-2 py-0.5 rounded-full border ${SLOT_BORDER_COLORS[ci]} ${SLOT_BG_LIGHT[ci]}`}
                                >
                                  {project.name} {formatHM(projMins)}
                                </span>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ================================================================ */}
        {/* MONTH VIEW                                                       */}
        {/* ================================================================ */}
        {activeTab === "month" && (
          <>
            {/* Per-project aggregation cards */}
            <ProjectSummaryCards items={monthItems} colorMap={colorMap} hoursPerManDay={hoursPerManDay} />

            {/* Donut chart */}
            <ProjectDonutChart items={monthItems} colorMap={colorMap} />

            {/* Weekly breakdown within the month */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Weekly Breakdown</h2>
              <div className="space-y-3">
                {(() => {
                  const ms = startOfMonth(selectedDate);
                  const me = endOfMonth(selectedDate);
                  const weeks: { from: Date; to: Date }[] = [];
                  let cursor = ms;
                  while (cursor < me) {
                    const weekEnd = addDays(cursor, 7 - cursor.getDay() || 7);
                    const to = weekEnd > me ? me : weekEnd;
                    weeks.push({ from: new Date(cursor), to });
                    cursor = to;
                  }

                  return weeks.map(({ from, to }, idx) => {
                    const weekItemsList = monthItems.filter((it) => {
                      const d = new Date(it.startedAt);
                      return d >= from && d < to;
                    });
                    const weekTotal = totalMinutes(weekItemsList);

                    return (
                      <div
                        key={idx}
                        className="rounded-lg border bg-card px-4 py-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {from.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            –{" "}
                            {addDays(to, -1).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-sm font-semibold">
                            {weekTotal > 0 ? formatHM(weekTotal) : "—"}
                          </span>
                        </div>
                        {weekItemsList.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {aggregateByProject(weekItemsList).map(
                              ({ project, totalMins: projMins }) => {
                                const ci = getColorIndex(
                                  project.id,
                                  colorMap
                                );
                                return (
                                  <span
                                    key={project.id}
                                    className={`text-xs px-2 py-0.5 rounded-full border ${SLOT_BORDER_COLORS[ci]} ${SLOT_BG_LIGHT[ci]}`}
                                  >
                                    {project.name} {formatHM(projMins)}
                                  </span>
                                );
                              }
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </>
        )}
        {/* Edit entry dialog */}
        <Dialog
          open={!!editItem}
          onOpenChange={(open) => {
            if (!open) {
              setEditItem(null);
              setEditError(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Work Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditEntry} className="space-y-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={editForm.startedAt}
                  onChange={(e) =>
                    setEditForm({ ...editForm, startedAt: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={editForm.endedAt}
                  onChange={(e) =>
                    setEditForm({ ...editForm, endedAt: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  placeholder="Optional description"
                />
              </div>
              {editError && (
                <p className="text-sm text-destructive">{editError}</p>
              )}
              <Button type="submit" className="w-full">
                Save
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <ConfirmDialog
          open={deleteItemId !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteItemId(null);
          }}
          title="Delete time entry"
          description="Are you sure you want to delete this time entry? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDeleteItem}
        />
      </div>
    </AppLayout>
  );
}
