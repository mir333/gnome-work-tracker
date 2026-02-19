import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
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

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/projects/${id}/work-items`, form);
    setForm({ startedAt: "", endedAt: "", description: "" });
    setDialogOpen(false);
    load();
  }

  if (!project) return <AppLayout><div>Loading...</div></AppLayout>;

  const triggerUrl = `${window.location.origin}/api/trigger/{token}/${project.slug}`;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-gray-500 font-mono text-sm mt-1">
          Slug: {project.slug}
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Trigger URL:{" "}
          <code className="bg-gray-100 px-2 py-1 rounded text-xs">
            {triggerUrl}
          </code>
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Work Items</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Work Entry</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Manual Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddEntry} className="space-y-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={form.startedAt}
                  onChange={(e) =>
                    setForm({ ...form, startedAt: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={form.endedAt}
                  onChange={(e) =>
                    setForm({ ...form, endedAt: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <Button type="submit">Add</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {new Date(item.startedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>{formatTime(item.startedAt)}</TableCell>
              <TableCell>
                {item.endedAt ? (
                  formatTime(item.endedAt)
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
              </TableCell>
              <TableCell>
                {formatDuration(item.startedAt, item.endedAt)}
              </TableCell>
              <TableCell>{item.description || "\u2014"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AppLayout>
  );
}
