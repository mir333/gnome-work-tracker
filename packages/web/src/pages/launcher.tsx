import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
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

export function LauncherPage() {
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Status */}
        <div className="text-center mb-6">
          {status.active ? (
            <p className="text-lg">
              Working on:{" "}
              <span className="font-semibold">
                {status.active.project.name}
              </span>
            </p>
          ) : (
            <p className="text-gray-500">Not tracking</p>
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
          <p className="text-gray-400 text-sm text-center mb-4">
            No projects on dashboard.
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

        {/* Link to full app */}
        <div className="text-center">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
            Open full app
          </Link>
        </div>
      </div>
    </div>
  );
}
