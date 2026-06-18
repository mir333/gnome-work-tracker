import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHM } from "@/lib/date-utils";
import type { TimesheetResult } from "@/lib/timesheet-types";
import { Download, RotateCcw } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimesheetTableProps {
  timesheet: TimesheetResult;
  editable?: boolean;
  showProject?: boolean;
  /** Label for the summary card total (e.g. "Monthly Total", "Weekly Total"). */
  totalLabel?: string;
  onAdjust?: (
    projectId: string,
    date: string,
    adjustedMinutes: number,
    description?: string
  ) => Promise<void>;
  onReset?: (entryId: string) => Promise<void>;
  onExport?: () => void;
}

// ---------------------------------------------------------------------------
// Inline edit cell
// ---------------------------------------------------------------------------

function EditableHoursCell({
  effectiveMinutes,
  rawMinutes,
  isAdjusted,
  timesheetEntryId,
  onSave,
  onReset,
}: {
  effectiveMinutes: number;
  rawMinutes: number;
  isAdjusted: boolean;
  timesheetEntryId: string | null;
  onSave: (minutes: number) => Promise<void>;
  onReset?: (entryId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    setValue((effectiveMinutes / 60).toFixed(2));
    setEditing(true);
  }

  async function save() {
    const hours = parseFloat(value);
    if (!isNaN(hours) && hours >= 0) {
      const minutes = Math.round(hours * 60);
      await onSave(minutes);
    }
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        step="0.25"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
        className="h-7 w-20 text-sm font-mono"
      />
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <span
        className="font-mono text-sm font-medium cursor-pointer hover:underline"
        onClick={startEdit}
        title={
          isAdjusted
            ? `Adjusted (raw: ${formatHM(rawMinutes)})`
            : "Click to adjust"
        }
      >
        {formatHM(effectiveMinutes)}
      </span>
      {isAdjusted && (
        <>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"
            title={`Adjusted — raw: ${formatHM(rawMinutes)}`}
          />
          {onReset && timesheetEntryId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onReset(timesheetEntryId);
              }}
              title="Reset to raw"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function EditableDescriptionCell({
  description,
  rawDescription,
  isAdjusted,
  onSave,
}: {
  description: string;
  rawDescription: string;
  isAdjusted: boolean;
  onSave: (description: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    setValue(description === "\u2014" ? "" : description);
    setEditing(true);
  }

  async function save() {
    await onSave(value);
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
        className="h-7 text-sm"
      />
    );
  }

  return (
    <span
      className="text-muted-foreground text-sm max-w-[300px] truncate block cursor-pointer hover:underline"
      onClick={startEdit}
      title={
        isAdjusted && rawDescription
          ? `Adjusted — raw: ${rawDescription}`
          : description
      }
    >
      {description}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TimesheetTable({
  timesheet,
  editable = false,
  showProject = false,
  totalLabel = "Monthly Total",
  onAdjust,
  onReset,
  onExport,
}: TimesheetTableProps) {
  const { entries, totalRawMinutes, totalEffectiveMinutes, manDays } =
    timesheet;

  const hasAdjustments = totalRawMinutes !== totalEffectiveMinutes;

  return (
    <>
      {/* Summary card */}
      <Card className="mb-4">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                {totalLabel}
              </span>
              <div className="text-lg font-semibold">
                {formatHM(totalEffectiveMinutes)}{" "}
                <span className="text-muted-foreground font-normal text-sm">
                  ({manDays} MD)
                </span>
              </div>
            </div>
            {hasAdjustments && (
              <div className="text-xs text-muted-foreground">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1" />
                Raw: {formatHM(totalRawMinutes)}
              </div>
            )}
          </div>
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      {entries.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-muted-foreground text-sm">
            No work items this month
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                {showProject && <TableHead>Project</TableHead>}
                <TableHead>Hours</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, idx) => (
                <TableRow key={`${entry.date}-${entry.projectId}-${idx}`}>
                  <TableCell className="text-muted-foreground">
                    {new Date(entry.date + "T12:00:00").toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.dayName}
                  </TableCell>
                  {showProject && (
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {entry.projectName}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    {editable && onAdjust ? (
                      <EditableHoursCell
                        effectiveMinutes={entry.effectiveMinutes}
                        rawMinutes={entry.rawMinutes}
                        isAdjusted={entry.isAdjusted}
                        timesheetEntryId={entry.timesheetEntryId}
                        onSave={async (minutes) => {
                          await onAdjust(
                            entry.projectId,
                            entry.date,
                            minutes
                          );
                        }}
                        onReset={onReset}
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-sm font-medium">
                          {formatHM(entry.effectiveMinutes)}
                        </span>
                        {entry.isAdjusted && (
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"
                            title={`Adjusted — raw: ${formatHM(entry.rawMinutes)}`}
                          />
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editable && onAdjust ? (
                      <EditableDescriptionCell
                        description={entry.description}
                        rawDescription={entry.rawDescription}
                        isAdjusted={
                          entry.isAdjusted &&
                          entry.description !== entry.rawDescription
                        }
                        onSave={async (desc) => {
                          await onAdjust(
                            entry.projectId,
                            entry.date,
                            entry.effectiveMinutes,
                            desc
                          );
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm max-w-md truncate block">
                        {entry.description}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow className="font-semibold border-t-2">
                <TableCell colSpan={showProject ? 3 : 2}>Total</TableCell>
                <TableCell className="font-mono">
                  {formatHM(totalEffectiveMinutes)}
                </TableCell>
                <TableCell>{manDays} MD</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
