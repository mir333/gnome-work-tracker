import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  formatHM,
  toDateString,
  startOfMonth,
  endOfMonth,
  formatMonth,
} from "@/lib/date-utils";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkItemWithProject {
  id: string;
  startedAt: string;
  endedAt: string | null;
  project: { id: string; name: string; slug: string };
}

interface MemberReport {
  userId: string;
  userName: string;
  role: string;
  workItems: WorkItemWithProject[];
}

// ---------------------------------------------------------------------------
// Colour palette (shared with other pages)
// ---------------------------------------------------------------------------

const SLOT_BORDER_COLORS = [
  "border-blue-500",
  "border-green-500",
  "border-purple-500",
  "border-orange-500",
  "border-pink-500",
  "border-teal-500",
];

const SLOT_BG_LIGHT = [
  "bg-blue-50 dark:bg-blue-950/30",
  "bg-green-50 dark:bg-green-950/30",
  "bg-purple-50 dark:bg-purple-950/30",
  "bg-orange-50 dark:bg-orange-950/30",
  "bg-pink-50 dark:bg-pink-950/30",
  "bg-teal-50 dark:bg-teal-950/30",
];

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  manager:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  member:
    "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcTotalMins(items: WorkItemWithProject[]): number {
  let total = 0;
  for (const item of items) {
    const s = new Date(item.startedAt).getTime();
    const e = item.endedAt ? new Date(item.endedAt).getTime() : Date.now();
    total += Math.max(0, Math.floor((e - s) / 60000));
  }
  return total;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OrgReportPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const [orgName, setOrgName] = useState("");
  const [reportData, setReportData] = useState<MemberReport[]>([]);
  const [hoursPerManDay, setHoursPerManDay] = useState(8);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const monthLabel = formatMonth(selectedMonth);

  function navigateMonth(direction: -1 | 1) {
    setSelectedMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + direction);
      return next;
    });
  }

  const loadReport = useCallback(
    async (date: Date) => {
      if (!orgId) return;
      setLoading(true);
      try {
        const ms = startOfMonth(date);
        const me = endOfMonth(date);
        const [data, settings, org] = await Promise.all([
          api.get(
            `/organisations/${orgId}/report?from=${toDateString(ms)}&to=${toDateString(me)}`
          ),
          api.get("/profile/settings"),
          api.get(`/organisations/${orgId}`),
        ]);
        setReportData(data);
        setHoursPerManDay(settings.hoursPerManDay);
        setOrgName(org.name);
      } catch {
        setReportData([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId]
  );

  useEffect(() => {
    loadReport(selectedMonth);
  }, [selectedMonth, loadReport]);

  // Compute totals
  const memberTotals = useMemo(
    () =>
      reportData
        .map((m) => ({
          ...m,
          totalMins: calcTotalMins(m.workItems),
        }))
        .sort((a, b) => b.totalMins - a.totalMins),
    [reportData]
  );

  const grandTotal = useMemo(
    () => memberTotals.reduce((sum, m) => sum + m.totalMins, 0),
    [memberTotals]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back button + title */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-muted-foreground"
            onClick={() => navigate("/organisation")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Organisation
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {orgName ? `${orgName} — Report` : "Organisation Report"}
          </h1>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigateMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {monthLabel}
          </h2>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigateMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Grand total */}
        <Card className="mb-4">
          <div className="px-6 py-4 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Team Total
            </span>
            <span className="text-lg font-semibold">
              {formatHM(grandTotal)}{" "}
              <span className="text-muted-foreground font-normal text-sm">
                ({(grandTotal / 60 / hoursPerManDay).toFixed(1)} MD)
              </span>
            </span>
          </div>
        </Card>

        {/* Per-member breakdown cards */}
        {loading ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Loading report...
          </p>
        ) : memberTotals.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No data for {monthLabel}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {memberTotals.map((member, idx) => {
              const ci = idx % SLOT_BORDER_COLORS.length;
              const manDays = (
                member.totalMins /
                60 /
                hoursPerManDay
              ).toFixed(1);
              return (
                <Card
                  key={member.userId}
                  className={`${SLOT_BG_LIGHT[ci]} border-l-4 ${SLOT_BORDER_COLORS[ci]} cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]`}
                  onClick={() =>
                    navigate(
                      `/organisation/${orgId}/members/${member.userId}`
                    )
                  }
                >
                  <CardContent className="py-4 px-4">
                    <div className="text-sm font-medium text-muted-foreground truncate">
                      {member.userName}
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] mt-1 ${ROLE_COLORS[member.role] ?? ""}`}
                    >
                      {member.role}
                    </Badge>
                    <div className="text-xl font-bold mt-2">
                      {formatHM(member.totalMins)}{" "}
                      <span className="text-muted-foreground font-normal text-xs">
                        ({manDays} MD)
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
