import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { Plus, Pencil, Trash2, LayoutDashboard } from "lucide-react";

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
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");

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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
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
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          to={`/projects/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
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
                        <div className="flex items-center justify-end gap-2">
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
