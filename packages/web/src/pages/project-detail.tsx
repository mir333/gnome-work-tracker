import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface WorkItem {
  id: string;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
}

function formatDuration(start: string, end: string | null): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const mins = Math.floor((e - s) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    startedAt: "",
    endedAt: "",
    description: "",
  });
  const [editItem, setEditItem] = useState<WorkItem | null>(null);
  const [editForm, setEditForm] = useState({
    startedAt: "",
    endedAt: "",
    description: "",
  });

  async function load() {
    const [p, w] = await Promise.all([
      api.get(`/projects/${id}`),
      api.get(`/projects/${id}/work-items`),
    ]);
    setProject(p);
    setItems(w);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/projects/${id}/work-items`, addForm);
    setAddForm({ startedAt: "", endedAt: "", description: "" });
    setAddOpen(false);
    load();
  }

  function openEdit(item: WorkItem) {
    setEditItem(item);
    setEditForm({
      startedAt: toLocalDatetime(item.startedAt),
      endedAt: item.endedAt ? toLocalDatetime(item.endedAt) : "",
      description: item.description || "",
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    await api.put(`/work-items/${editItem.id}`, {
      startedAt: editForm.startedAt,
      endedAt: editForm.endedAt || undefined,
      description: editForm.description,
    });
    setEditItem(null);
    load();
  }

  async function handleDelete(itemId: string) {
    await api.delete(`/work-items/${itemId}`);
    load();
  }

  if (!project)
    return (
      <AppLayout>
        <div className="text-muted-foreground p-8">Loading...</div>
      </AppLayout>
    );

  const triggerUrl = `${window.location.origin}/api/trigger/{token}/${project.slug}`;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <Badge variant="secondary" className="font-mono text-xs">
              {project.slug}
            </Badge>
            <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {triggerUrl}
            </code>
          </div>
        </div>

        {/* Work Items Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Work Items</h2>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Manual Entry</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="datetime-local"
                    value={addForm.startedAt}
                    onChange={(e) =>
                      setAddForm({ ...addForm, startedAt: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="datetime-local"
                    value={addForm.endedAt}
                    onChange={(e) =>
                      setAddForm({ ...addForm, endedAt: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={addForm.description}
                    onChange={(e) =>
                      setAddForm({ ...addForm, description: e.target.value })
                    }
                    placeholder="Optional description"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Add
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit dialog */}
        <Dialog
          open={!!editItem}
          onOpenChange={(open) => {
            if (!open) setEditItem(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Work Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={editForm.startedAt}
                  onChange={(e) =>
                    setEditForm({ ...editForm, startedAt: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={editForm.endedAt}
                  onChange={(e) =>
                    setEditForm({ ...editForm, endedAt: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  placeholder="Optional description"
                />
              </div>
              <Button type="submit" className="w-full">
                Save
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Table */}
        {items.length === 0 ? (
          <Card>
            <div className="py-12 text-center text-muted-foreground text-sm">
              No work items yet
            </div>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.startedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatTime(item.startedAt)}
                    </TableCell>
                    <TableCell>
                      {item.endedAt ? (
                        <span className="font-mono text-sm">
                          {formatTime(item.endedAt)}
                        </span>
                      ) : (
                        <Badge>Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDuration(item.startedAt, item.endedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.description || "\u2014"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
