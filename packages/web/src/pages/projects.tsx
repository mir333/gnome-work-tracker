import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  formatHM,
  toDateString,
  startOfMonth,
  endOfMonth,
  formatMonth,
} from "@/lib/date-utils";
import { Plus, Pencil, Trash2, LayoutDashboard, ChevronLeft, ChevronRight } from "lucide-react";

interface Project {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

interface DashboardSlot {
  slot: number;
  projectId: string;
  project: { id: string };
}

interface WorkItemWithProject {
  id: string;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
  project: { id: string; name: string; slug: string };
}

// ---------------------------------------------------------------------------
// Colour palette (shared with dashboard)
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

function aggregateByProject(items: WorkItemWithProject[]) {
  const map = new Map<
    string,
    { project: { id: string; name: string; slug: string }; totalMins: number }
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [dashboardProjectIds, setDashboardProjectIds] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");

  // Monthly summary state
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [monthItems, setMonthItems] = useState<WorkItemWithProject[]>([]);
  const [hoursPerManDay, setHoursPerManDay] = useState(8);

  async function load() {
    const [data, slots] = await Promise.all([
      api.get("/projects"),
      api.get("/dashboard"),
    ]);
    setProjects(data);
    setDashboardProjectIds(new Set(slots.map((s: DashboardSlot) => s.projectId)));
  }

  const loadMonth = useCallback(async (date: Date) => {
    const ms = startOfMonth(date);
    const me = endOfMonth(date);
    const st = await api.get(
      `/status?from=${toDateString(ms)}&to=${toDateString(me)}`
    );
    setMonthItems(st.items ?? []);
  }, []);

  const loadSettings = useCallback(async () => {
    const data = await api.get("/profile/settings");
    setHoursPerManDay(data.hoursPerManDay);
  }, []);

  useEffect(() => {
    load();
    loadSettings();
  }, []);

  useEffect(() => {
    loadMonth(selectedMonth);
  }, [selectedMonth, loadMonth]);

  const byProject = useMemo(() => aggregateByProject(monthItems), [monthItems]);

  const monthTotalMins = useMemo(
    () => byProject.reduce((sum, p) => sum + p.totalMins, 0),
    [byProject]
  );

  const monthLabel = formatMonth(selectedMonth);

  function navigateMonth(direction: -1 | 1) {
    setSelectedMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + direction);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Project CRUD
  // ---------------------------------------------------------------------------

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/projects", { name: newName });
    setNewName("");
    setDialogOpen(false);
    load();
    loadMonth(selectedMonth);
  }

  async function handleEditName(e: React.FormEvent) {
    e.preventDefault();
    if (!editProject) return;
    await api.put(`/projects/${editProject.id}`, { name: editName });
    setEditProject(null);
    load();
  }

  async function handleDelete(id: string) {
    await api.delete(`/projects/${id}`);
    load();
    loadMonth(selectedMonth);
  }

  async function toggleDashboard(projectId: string) {
    const slots: DashboardSlot[] = await api.get("/dashboard");
    const existing = slots.find((s) => s.projectId === projectId);

    if (existing) {
      const payload = slots
        .filter((s) => s.projectId !== projectId)
        .map((s, i) => ({ slot: i + 1, projectId: s.projectId }));
      const allSlots = Array.from({ length: 6 }, (_, i) => ({
        slot: i + 1,
        projectId: payload[i]?.projectId ?? null,
      }));
      await api.put("/dashboard", { slots: allSlots });
    } else {
      const usedSlots = new Set(slots.map((s) => s.slot));
      let freeSlot = 0;
      for (let i = 1; i <= 6; i++) {
        if (!usedSlots.has(i)) {
          freeSlot = i;
          break;
        }
      }
      if (freeSlot === 0) return;
      const payload = [{ slot: freeSlot, projectId }];
      await api.put("/dashboard", { slots: payload });
    }
    load();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* ================================================================ */}
        {/* MONTHLY SUMMARY                                                  */}
        {/* ================================================================ */}
        <div className="mb-8">
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

          {/* Grand total card */}
          <Card className="mb-4">
            <div className="px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Monthly Total
              </span>
              <span className="text-lg font-semibold">
                {formatHM(monthTotalMins)}{" "}
                <span className="text-muted-foreground font-normal text-sm">
                  ({(monthTotalMins / 60 / hoursPerManDay).toFixed(1)} MD)
                </span>
              </span>
            </div>
          </Card>

          {/* Per-project breakdown — clickable cards */}
          {byProject.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {byProject.map(({ project, totalMins }, idx) => {
                const ci = idx % SLOT_BORDER_COLORS.length;
                const manDays = (totalMins / 60 / hoursPerManDay).toFixed(1);
                return (
                  <Card
                    key={project.id}
                    className={`${SLOT_BG_LIGHT[ci]} border-l-4 ${SLOT_BORDER_COLORS[ci]} cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]`}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <CardContent className="py-4 px-4">
                      <div className="text-sm font-medium text-muted-foreground truncate">
                        {project.name}
                      </div>
                      <div className="text-xl font-bold mt-1">
                        {formatHM(totalMins)}{" "}
                        <span className="text-muted-foreground font-normal text-xs">
                          ({manDays} MD)
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {byProject.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">
              No work logged in {monthLabel}
            </p>
          )}
        </div>

        {/* ================================================================ */}
        {/* PROJECT LIST                                                     */}
        {/* ================================================================ */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your tracked projects
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="My Project"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Create
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No projects yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => {
                  const onDashboard = dashboardProjectIds.has(p.id);
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <TableCell>
                        <span className="font-medium hover:underline">
                          {p.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {p.slug}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant={onDashboard ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleDashboard(p.id)}
                            title={
                              onDashboard
                                ? "Remove from dashboard"
                                : "Add to dashboard"
                            }
                          >
                            <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                            {onDashboard ? "On Dashboard" : "Dashboard"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditProject(p);
                              setEditName(p.name);
                            }}
                            title="Rename project"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(p.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Rename project dialog */}
        <Dialog
          open={!!editProject}
          onOpenChange={(open) => {
            if (!open) setEditProject(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Project Name</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Save
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
