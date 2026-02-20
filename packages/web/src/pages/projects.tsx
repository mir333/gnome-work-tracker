import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api";

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

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [dashboardProjectIds, setDashboardProjectIds] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function load() {
    const [data, slots] = await Promise.all([
      api.get("/projects"),
      api.get("/dashboard"),
    ]);
    setProjects(data);
    setDashboardProjectIds(new Set(slots.map((s: DashboardSlot) => s.projectId)));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/projects", { name: newName });
    setNewName("");
    setDialogOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    await api.delete(`/projects/${id}`);
    load();
  }

  async function toggleDashboard(projectId: string) {
    const slots: DashboardSlot[] = await api.get("/dashboard");
    const existing = slots.find((s) => s.projectId === projectId);

    if (existing) {
      // Remove from dashboard
      const payload = slots
        .filter((s) => s.projectId !== projectId)
        .map((s, i) => ({ slot: i + 1, projectId: s.projectId }));
      // Fill remaining slots with null to clear them
      const allSlots = Array.from({ length: 6 }, (_, i) => ({
        slot: i + 1,
        projectId: payload[i]?.projectId ?? null,
      }));
      await api.put("/dashboard", { slots: allSlots });
    } else {
      // Add to first empty slot
      const usedSlots = new Set(slots.map((s) => s.slot));
      let freeSlot = 0;
      for (let i = 1; i <= 6; i++) {
        if (!usedSlots.has(i)) {
          freeSlot = i;
          break;
        }
      }
      if (freeSlot === 0) return; // All slots full
      const payload = [{ slot: freeSlot, projectId }];
      await api.put("/dashboard", { slots: payload });
    }
    load();
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>New Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => {
            const onDashboard = dashboardProjectIds.has(p.id);
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <Link to={`/projects/${p.id}`} className="underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-sm">{p.slug}</TableCell>
                <TableCell>
                  {new Date(p.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={onDashboard ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDashboard(p.id)}
                      title={onDashboard ? "Remove from dashboard" : "Add to dashboard"}
                    >
                      {onDashboard ? "On Dashboard" : "Add to Dashboard"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(p.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </AppLayout>
  );
}
