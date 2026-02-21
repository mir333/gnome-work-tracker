import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Square, Clock } from "lucide-react";

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

const SLOT_BORDER_COLORS = [
  "border-blue-500",
  "border-green-500",
  "border-purple-500",
  "border-orange-500",
  "border-pink-500",
  "border-teal-500",
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

  const colorMap: Record<string, number> = {};
  slots.forEach((s, i) => {
    colorMap[s.project.id] = i % SLOT_COLORS.length;
  });

  const now = new Date();

  const totalMins = status.today.reduce((acc, item) => {
    const start = new Date(item.startedAt);
    const end = item.endedAt ? new Date(item.endedAt) : new Date();
    return acc + Math.floor((end.getTime() - start.getTime()) / 60000);
  }, 0);
  const totalH = Math.floor(totalMins / 60);
  const totalM = totalMins % 60;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            {status.active ? (
              <Badge variant="default" className="text-sm py-1 px-3">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
                Working on {status.active.project.name}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-sm py-1 px-3">
                Not tracking
              </Badge>
            )}
            {totalMins > 0 && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {totalH}h {totalM}m today
              </span>
            )}
          </div>
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
          <Card className="mb-4">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No projects on dashboard. Go to Projects and click "Add to
              Dashboard".
            </CardContent>
          </Card>
        )}

        {/* Stop */}
        <Button
          variant="destructive"
          className="w-full mb-10"
          onClick={stopAll}
          disabled={!status.active}
        >
          <Square className="mr-2 h-4 w-4" />
          Stop Tracking
        </Button>

        {/* Today's Timeline */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Today's Timeline</h2>
          <div className="space-y-1.5">
            {status.today.map((item) => {
              const start = new Date(item.startedAt);
              const end = item.endedAt ? new Date(item.endedAt) : new Date();
              const mins = Math.floor(
                (end.getTime() - start.getTime()) / 60000
              );
              const colorIdx = colorMap[item.project.id] ?? 0;
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
                    onClick={() => navigate(`/projects/${item.project.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.project.name}</span>
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        {mins}m
                        {!item.endedAt && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {status.today.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">
                No work logged today
              </p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
