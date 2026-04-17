import { useEffect, useState, useCallback, useRef } from "react";
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

export function LauncherPage() {
  const [slots, setSlots] = useState<DashboardSlot[]>([]);
  const [status, setStatus] = useState<Status>({ active: null, today: [] });
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const noteInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (noteOpen && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [noteOpen]);

  async function triggerProject(slug: string) {
    await api.get(`/trigger/session/${slug}`);
    const st = await api.get("/status");
    setStatus(st);
  }

  async function stopAll() {
    await api.get("/trigger/session/stop");
    setNoteOpen(false);
    setNoteText("");
    const st = await api.get("/status");
    setStatus(st);
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    try {
      await api.post("/work-items/active/description", {
        description: noteText.trim(),
      });
      setNoteText("");
      setNoteOpen(false);
    } catch {
      // silently fail
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <div className="gnome-shell">
      {/* Top panel bar */}
      <div className="gnome-panel">
        <div className="gnome-bar">
          {slots.map((s) => {
            const isActive = status.active?.project.id === s.project.id;
            return (
              <button
                key={s.slot}
                onClick={() => triggerProject(s.project.slug)}
                className={`gnome-btn${isActive ? " gnome-btn-active" : ""}`}
              >
                {s.project.name}
              </button>
            );
          })}

          {/* Note button */}
          <button
            className="gnome-btn gnome-btn-note"
            onClick={() => {
              if (!status.active) return;
              setNoteOpen(!noteOpen);
            }}
            disabled={!status.active}
            title="Add note"
          >
            ✎
          </button>

          {/* Stop button */}
          <button
            className="gnome-btn gnome-btn-stop"
            onClick={stopAll}
            disabled={!status.active}
            title="Stop tracking"
          >
            ■
          </button>
        </div>
      </div>

      {/* Note dropdown — anchored below the bar, GNOME popup style */}
      {noteOpen && status.active && (
        <div className="gnome-popup">
          <div className="gnome-popup-row">
            <span className="gnome-popup-label">Note:</span>
            <input
              ref={noteInputRef}
              className="gnome-popup-input"
              type="text"
              placeholder="What are you working on?"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addNote();
              }}
            />
            <button
              className="gnome-popup-save"
              onClick={addNote}
              disabled={!noteText.trim() || noteSaving}
            >
              {noteSaving ? "…" : "Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
