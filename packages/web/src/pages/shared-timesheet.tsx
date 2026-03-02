import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
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
import { formatHM, toDateString, shortDayName } from "@/lib/date-utils";

interface WorkItem {
  id: string;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
}

interface SharedProject {
  id: string;
  name: string;
  slug: string;
}

interface SharedData {
  project: SharedProject;
  month: string;
  workItems: WorkItem[];
}

interface DayRow {
  date: string;
  dayName: string;
  totalMins: number;
  descriptions: string;
}

function aggregateByDay(items: WorkItem[]): DayRow[] {
  const map = new Map<string, { totalMins: number; descriptions: Set<string> }>();

  for (const item of items) {
    const dateKey = toDateString(new Date(item.startedAt));
    const entry = map.get(dateKey) || {
      totalMins: 0,
      descriptions: new Set<string>(),
    };

    const s = new Date(item.startedAt).getTime();
    const e = item.endedAt ? new Date(item.endedAt).getTime() : Date.now();
    entry.totalMins += Math.floor((e - s) / 60000);

    if (item.description?.trim()) {
      entry.descriptions.add(item.description.trim());
    }

    map.set(dateKey, entry);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, { totalMins, descriptions }]) => ({
      date: dateStr,
      dayName: shortDayName(new Date(dateStr + "T12:00:00")),
      totalMins,
      descriptions: Array.from(descriptions).join("; ") || "\u2014",
    }));
}

export function SharedTimesheetPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedData | null>(null);
  const [hoursPerManDay, setHoursPerManDay] = useState(8);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get(`/shared/${token}`),
      api.get("/profile/settings"),
    ])
      .then(([shared, settings]) => {
        setData(shared);
        setHoursPerManDay(settings.hoursPerManDay);
      })
      .catch(() => {
        setError("This share link is invalid or has been revoked.");
      });
  }, [token]);

  const dayRows = useMemo(
    () => (data ? aggregateByDay(data.workItems) : []),
    [data]
  );

  const monthTotalMins = useMemo(
    () => dayRows.reduce((sum, r) => sum + r.totalMins, 0),
    [dayRows]
  );

  const manDays = useMemo(
    () => (monthTotalMins / 60 / hoursPerManDay).toFixed(1),
    [monthTotalMins, hoursPerManDay]
  );

  const monthLabel = useMemo(() => {
    if (!data) return "";
    const [year, mon] = data.month.split("-").map(Number);
    const d = new Date(year, mon - 1, 1);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [data]);

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <div className="py-12 text-center text-muted-foreground text-sm">
              {error}
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="text-muted-foreground p-8">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {data.project.name}
            </h1>
            <Badge variant="secondary">Shared</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">{monthLabel}</p>
        </div>

        {/* Monthly summary */}
        <Card className="mb-4">
          <div className="px-6 py-4 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Monthly Total
            </span>
            <span className="text-lg font-semibold">
              {formatHM(monthTotalMins)}{" "}
              <span className="text-muted-foreground font-normal text-sm">
                ({manDays} MD)
              </span>
            </span>
          </div>
        </Card>

        {/* Timesheet table */}
        {dayRows.length === 0 ? (
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
                  <TableHead>Hours</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayRows.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="text-muted-foreground">
                      {new Date(row.date + "T12:00:00").toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.dayName}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {formatHM(row.totalMins)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-md truncate">
                      {row.descriptions}
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
