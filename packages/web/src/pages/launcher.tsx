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
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");

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
    setNoteOpen(false);
    setNoteText("");
    setNoteError("");
    const st = await api.get("/status");
    setStatus(st);
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    setNoteError("");
    try {
      await api.post("/work-items/active/description", { description: noteText.trim() });
      setNoteText("");
      setNoteOpen(false);
    } catch (e: any) {
      setNoteError(e.message || "Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg">
        {/* Status */}
        <div className="text-center mb-4 sm:mb-6">
          {status.active ? (
            <Badge variant="default" className="text-xs sm:text-sm py-1 sm:py-1.5 px-3 sm:px-4">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
              Working on {status.active.project.name}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs sm:text-sm py-1 sm:py-1.5 px-3 sm:px-4">
              Not tracking
            </Badge>
          )}
        </div>

        {/* Project Buttons — responsive grid: 1 col on tiny, 2 on small, 3 on wider */}
        {slots.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
            {slots.map((s, i) => {
              const isActive = status.active?.project.id === s.project.id;
              return (
                <Button
                  key={s.slot}
                  onClick={() => triggerProject(s.project.slug)}
                  className={`h-12 sm:h-14 md:h-16 text-sm sm:text-base font-medium transition-all w-full ${
                    isActive
                      ? SLOT_COLORS[i % SLOT_COLORS.length] +
                        " text-white shadow-md scale-[1.02]"
                      : "bg-card text-card-foreground border border-border hover:border-foreground/20"
                  }`}
                  variant={isActive ? "default" : "outline"}
                >
                  <span className="truncate">{s.project.name}</span>
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center mb-4">
            No projects on dashboard.
          </p>
        )}

        {/* Stop + Add Note */}
        <div className="mb-6 sm:mb-8 space-y-2">
          <Button
            variant="destructive"
            className="w-full h-10 sm:h-11 text-sm sm:text-base"
            onClick={stopAll}
            disabled={!status.active}
          >
            <Square className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Stop Tracking
          </Button>

          {status.active && (
            <>
              <Button
                variant="outline"
                className="w-full h-10 sm:h-11 text-sm sm:text-base"
                onClick={() => { setNoteOpen(!noteOpen); setNoteError(""); }}
              >
                Add Note
              </Button>
              {noteOpen && (
                <div className="space-y-2">
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={3}
                    placeholder="What are you working on?"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  {noteError && (
                    <p className="text-sm text-destructive">{noteError}</p>
                  )}
                  <Button
                    size="sm"
                    onClick={addNote}
                    disabled={!noteText.trim() || noteSaving}
                  >
                    {noteSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

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
