import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  toDateString,
  startOfMonth,
  endOfMonth,
  addMonths,
  formatMonth,
} from "@/lib/date-utils";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Share2, Copy, Check, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TimesheetTable } from "@/components/timesheet-table";
import type { TimesheetResult } from "@/lib/timesheet-types";

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

type TabKey = "items" | "timesheet";

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

  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // Pagination state
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // Edit project name
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("timesheet");

  // Monthly timesheet state
  const [sheetMonth, setSheetMonth] = useState(() => startOfMonth(new Date()));
  const [timesheet, setTimesheet] = useState<TimesheetResult | null>(null);

  // Share timesheet state
  interface ShareInfo {
    id: string;
    token: string;
    month: string;
    createdAt: string;
  }
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shares, setShares] = useState<ShareInfo[]>([]);

  async function load() {
    const [p, w] = await Promise.all([
      api.get(`/projects/${id}`),
      api.get(`/projects/${id}/work-items`),
    ]);
    setProject(p);
    setItems(w);
  }

  const loadTimesheet = useCallback(async () => {
    const from = toDateString(sheetMonth);
    const to = toDateString(endOfMonth(sheetMonth));
    const data = await api.get(
      `/timesheet?from=${from}&to=${to}&projectId=${id}`
    );
    setTimesheet(data);
  }, [id, sheetMonth]);

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (activeTab === "timesheet") {
      loadTimesheet();
    }
  }, [activeTab, loadTimesheet]);

  // Pagination: items are already sorted newest-first from the API
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginatedItems = useMemo(
    () => items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [items, currentPage]
  );

  // Reset to page 1 when items change (e.g. after add/delete)
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  async function handleEditProjectName(e: React.FormEvent) {
    e.preventDefault();
    await api.put(`/projects/${id}`, { name: editNameValue });
    setEditNameOpen(false);
    load();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    try {
      await api.post(`/projects/${id}/work-items`, {
        startedAt: new Date(addForm.startedAt).toISOString(),
        endedAt: new Date(addForm.endedAt).toISOString(),
        description: addForm.description,
      });
      setAddForm({ startedAt: "", endedAt: "", description: "" });
      setAddOpen(false);
      load();
      if (activeTab === "timesheet") loadTimesheet();
    } catch (err: any) {
      setAddError(err.message || "Failed to add entry");
    }
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
    try {
      await api.put(`/work-items/${editItem.id}`, {
        startedAt: new Date(editForm.startedAt).toISOString(),
        endedAt: editForm.endedAt ? new Date(editForm.endedAt).toISOString() : undefined,
        description: editForm.description,
      });
      setEditItem(null);
      load();
      if (activeTab === "timesheet") loadTimesheet();
    } catch (err: any) {
      // Show error inline if needed in the future
      console.error("Failed to update entry:", err.message);
    }
  }

  async function handleDelete(itemId: string) {
    await api.delete(`/work-items/${itemId}`);
    load();
    if (activeTab === "timesheet") loadTimesheet();
  }

  function prevMonth() {
    setSheetMonth((m) => startOfMonth(addMonths(m, -1)));
  }

  function nextMonth() {
    setSheetMonth((m) => startOfMonth(addMonths(m, 1)));
  }

  async function handleCreateShare() {
    const month = `${sheetMonth.getFullYear()}-${String(sheetMonth.getMonth() + 1).padStart(2, "0")}`;
    const share = await api.post(`/projects/${id}/shares`, { month });
    setShareToken(share.token);
    setShareDialogOpen(true);
    loadShares();
  }

  async function loadShares() {
    const data = await api.get(`/projects/${id}/shares`);
    setShares(data);
  }

  async function handleRevokeShare(shareId: string) {
    await api.delete(`/shares/${shareId}`);
    loadShares();
  }

  function copyShareLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/shared/${shareToken}`;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditNameValue(project.name);
                setEditNameOpen(true);
              }}
              title="Rename project"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <Badge variant="secondary" className="font-mono text-xs">
              {project.slug}
            </Badge>
            <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {triggerUrl}
            </code>
          </div>
        </div>

        {/* Rename project dialog */}
        <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditProjectName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editProjectName">Project Name</Label>
                <Input
                  id="editProjectName"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Save
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Tab Switcher */}
        <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1">
          {(
            [
              { key: "timesheet", label: "Monthly Timesheet" },
              { key: "items", label: "Work Items" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ================================================================ */}
        {/* WORK ITEMS TAB                                                   */}
        {/* ================================================================ */}
        {activeTab === "items" && (
          <>
            {/* Work Items Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Work Items</h2>
              <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setAddError(null); }}>
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
                    {addError && (
                      <p className="text-sm text-destructive">{addError}</p>
                    )}
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
                    {paginatedItems.map((item) => (
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
                              onClick={() => setDeleteItemId(item.id)}
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

            {/* Pagination */}
            {items.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, items.length)} of {items.length} entries
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      className="min-w-[2rem]"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* MONTHLY TIMESHEET TAB                                            */}
        {/* ================================================================ */}
        {activeTab === "timesheet" && (
          <>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-lg font-semibold">
                  {formatMonth(sheetMonth)}
                </h2>
                <Button variant="ghost" size="icon" onClick={nextMonth}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={handleCreateShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>

            {/* Share timesheet dialog */}
            <Dialog
              open={shareDialogOpen}
              onOpenChange={(open) => {
                setShareDialogOpen(open);
                if (open) loadShares();
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Timesheet</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Anyone with a valid login and this link can view this month's
                  timesheet.
                </p>
                {shareToken && (
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/shared/${shareToken}`}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyShareLink}
                      className="shrink-0"
                    >
                      {shareCopied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
                {shares.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-sm font-medium">Active share links</h3>
                    {shares.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between text-sm bg-muted rounded px-3 py-2"
                      >
                        <span className="font-mono text-xs">{s.month}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7"
                          onClick={() => handleRevokeShare(s.id)}
                          title="Revoke share link"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Timesheet table */}
            {timesheet ? (
              <TimesheetTable
                timesheet={timesheet}
                editable
                onAdjust={async (projectId, date, adjustedMinutes, description) => {
                  await api.put("/timesheet/entries", {
                    projectId,
                    date,
                    adjustedMinutes,
                    description,
                  });
                  loadTimesheet();
                }}
                onReset={async (entryId) => {
                  await api.delete(`/timesheet/entries/${entryId}`);
                  loadTimesheet();
                }}
                onExport={async () => {
                  const from = toDateString(sheetMonth);
                  const to = toDateString(endOfMonth(sheetMonth));
                  const blob = await api.getBlob(
                    `/timesheet/export/excel?from=${from}&to=${to}&projectId=${id}`
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `timesheet-${project.slug}-${from.slice(0, 7)}.xlsx`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              />
            ) : (
              <Card>
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Loading...
                </div>
              </Card>
            )}
          </>
        )}
        {/* Delete confirmation dialog */}
        <ConfirmDialog
          open={deleteItemId !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteItemId(null);
          }}
          title="Delete time entry"
          description="Are you sure you want to delete this time entry? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => {
            if (deleteItemId) handleDelete(deleteItemId);
            setDeleteItemId(null);
          }}
        />
      </div>
    </AppLayout>
  );
}
