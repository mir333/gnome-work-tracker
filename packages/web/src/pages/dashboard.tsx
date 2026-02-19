import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

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
  project: { id: string; name: string; slug: string };
}

interface Status {
  active: WorkItemWithProject | null;
  today: WorkItemWithProject[];
}

const SLOT_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
];

export function DashboardPage() {
  const [slots, setSlots] = useState<DashboardSlot[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<Status>({ active: null, today: [] });
  const [configOpen, setConfigOpen] = useState(false);
  const [configSlots, setConfigSlots] = useState<(string | null)[]>(
    Array(6).fill(null)
  );

  const load = useCallback(async () => {
    const [s, st, p] = await Promise.all([
      api.get("/dashboard"),
      api.get("/status"),
      api.get("/projects"),
    ]);
    setSlots(s);
    setStatus(st);
    setProjects(p);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openConfig() {
    const current = Array(6).fill(null) as (string | null)[];
    for (const s of slots) {
      current[s.slot - 1] = s.projectId;
    }
    setConfigSlots(current);
    setConfigOpen(true);
  }

  async function saveConfig() {
    const payload = configSlots.map((projectId, i) => ({
      slot: i + 1,
      projectId,
    }));
    await api.put("/dashboard", { slots: payload });
    setConfigOpen(false);
    load();
  }

  async function triggerProject(slug: string) {
    await api.get(`/trigger/session/${slug}`);
    const st = await api.get("/status");
    setStatus(st);
  }

  async function stopAll() {
    await api.get("/trigger/session/stop");
    const st = await api.get("/status");
    setStatus(st);
  }

  const colorMap: Record<string, string> = {};
  slots.forEach((s, i) => {
    colorMap[s.project.id] = SLOT_COLORS[i % SLOT_COLORS.length];
  });

  const now = new Date();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h1>
            {status.active ? (
              <p className="text-lg mt-1">
                Working on:{" "}
                <span className="font-semibold">
                  {status.active.project.name}
                </span>
              </p>
            ) : (
              <p className="text-gray-500 mt-1">Not tracking</p>
            )}
          </div>
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={openConfig}>
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure Dashboard Slots</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {configSlots.map((val, i) => (
                  <div key={i}>
                    <Label>Slot {i + 1}</Label>
                    <Select
                      value={val || "none"}
                      onValueChange={(v) => {
                        const next = [...configSlots];
                        next[i] = v === "none" ? null : v;
                        setConfigSlots(next);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Empty —</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Button onClick={saveConfig} className="w-full">
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Project Buttons - 3x2 grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {slots.map((s, i) => {
            const isActive = status.active?.project.id === s.project.id;
            return (
              <Button
                key={s.slot}
                onClick={() => triggerProject(s.project.slug)}
                variant={isActive ? "default" : "outline"}
                className={`h-16 text-lg ${isActive ? SLOT_COLORS[i % SLOT_COLORS.length] + " text-white" : ""}`}
              >
                {s.project.name}
              </Button>
            );
          })}
        </div>

        {/* Stop All */}
        <Button
          variant="destructive"
          className="w-full mb-8"
          onClick={stopAll}
        >
          Stop All
        </Button>

        {/* Today's Timeline */}
        <h2 className="text-lg font-semibold mb-3">Today</h2>
        <div className="space-y-1">
          {status.today.map((item) => {
            const start = new Date(item.startedAt);
            const end = item.endedAt ? new Date(item.endedAt) : new Date();
            const mins = Math.floor((end.getTime() - start.getTime()) / 60000);
            const color =
              colorMap[item.project.id] || "bg-gray-400";
            return (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12 text-right">
                  {start.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div
                  className={`${color} text-white rounded px-3 py-1 text-sm flex-1`}
                >
                  {item.project.name} — {mins}m
                  {!item.endedAt && " (active)"}
                </div>
              </div>
            );
          })}
          {status.today.length === 0 && (
            <p className="text-gray-400 text-sm">No work logged today</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
