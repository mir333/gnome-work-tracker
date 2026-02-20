import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
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
  const navigate = useNavigate();
  const [slots, setSlots] = useState<DashboardSlot[]>([]);
  const [status, setStatus] = useState<Status>({ active: null, today: [] });

  const load = useCallback(async () => {
    const [s, st] = await Promise.all([
      api.get("/dashboard"),
      api.get("/status"),
    ]);
    setSlots(s);
    setStatus(st);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        <div className="mb-6">
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

        {/* Project Buttons - 3x2 grid */}
        {slots.length > 0 ? (
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
        ) : (
          <p className="text-gray-400 text-sm mb-4">
            No projects on dashboard. Go to Projects and click "Add to Dashboard".
          </p>
        )}

        {/* Stop All */}
        <Button
          variant="destructive"
          className="w-full mb-8"
          onClick={stopAll}
          disabled={!status.active}
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
                  className={`${color} text-white rounded px-3 py-1 text-sm flex-1 cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => navigate(`/projects/${item.project.id}`)}
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
