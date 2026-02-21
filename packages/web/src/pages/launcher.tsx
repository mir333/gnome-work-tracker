import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Square, ExternalLink } from "lucide-react";

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
  "bg-blue-500 hover:bg-blue-600",
  "bg-green-500 hover:bg-green-600",
  "bg-purple-500 hover:bg-purple-600",
  "bg-orange-500 hover:bg-orange-600",
  "bg-pink-500 hover:bg-pink-600",
  "bg-teal-500 hover:bg-teal-600",
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
    <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Status */}
        <div className="text-center mb-6">
          {status.active ? (
            <Badge variant="default" className="text-sm py-1.5 px-4">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
              Working on {status.active.project.name}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-sm py-1.5 px-4">
              Not tracking
            </Badge>
          )}
        </div>

        {/* Project Buttons */}
        {slots.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {slots.map((s, i) => {
              const isActive = status.active?.project.id === s.project.id;
              return (
                <Button
                  key={s.slot}
                  onClick={() => triggerProject(s.project.slug)}
                  className={`h-16 text-base font-medium transition-all ${
                    isActive
                      ? SLOT_COLORS[i % SLOT_COLORS.length] +
                        " text-white shadow-md scale-[1.02]"
                      : "bg-card text-card-foreground border border-border hover:border-foreground/20"
                  }`}
                  variant={isActive ? "default" : "outline"}
                >
                  {s.project.name}
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center mb-4">
            No projects on dashboard.
          </p>
        )}

        {/* Stop */}
        <Button
          variant="destructive"
          className="w-full mb-8"
          onClick={stopAll}
          disabled={!status.active}
        >
          <Square className="mr-2 h-4 w-4" />
          Stop Tracking
        </Button>

        {/* Link to full app */}
        <div className="text-center">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open full app
          </Link>
        </div>
      </div>
    </div>
  );
}
