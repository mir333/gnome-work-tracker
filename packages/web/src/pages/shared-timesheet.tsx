import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { TimesheetTable } from "@/components/timesheet-table";
import type { TimesheetResult } from "@/lib/timesheet-types";

interface SharedProject {
  id: string;
  name: string;
  slug: string;
}

interface SharedData {
  project: SharedProject;
  month: string;
  timesheet: TimesheetResult;
}

export function SharedTimesheetPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/shared/${token}`)
      .then((shared) => setData(shared))
      .catch(() => {
        setError("This share link is invalid or has been revoked.");
      });
  }, [token]);

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

        {/* Timesheet table (read-only) */}
        <TimesheetTable timesheet={data.timesheet} />
      </div>
    </AppLayout>
  );
}
