import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";

export function SettingsPage() {
  const [apiToken, setApiToken] = useState("");
  const [hoursPerManDay, setHoursPerManDay] = useState(8);
  const [savedHours, setSavedHours] = useState(8);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [profileData, settingsData] = await Promise.all([
      api.get("/profile"),
      api.get("/profile/settings"),
    ]);
    setApiToken(profileData.apiToken);
    setHoursPerManDay(settingsData.hoursPerManDay);
    setSavedHours(settingsData.hoursPerManDay);
  }

  useEffect(() => {
    load();
  }, []);

  async function regenerate() {
    const data = await api.post("/profile/regenerate-token", {});
    setApiToken(data.apiToken);
  }

  async function saveHoursPerManDay() {
    setSaving(true);
    try {
      const data = await api.put("/profile/settings", { hoursPerManDay });
      setSavedHours(data.hoursPerManDay);
    } finally {
      setSaving(false);
    }
  }

  const hoursChanged = hoursPerManDay !== savedHours;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your integration settings
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>API Token</CardTitle>
            <CardDescription>
              Use this token to configure the GNOME extension or trigger URLs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Your Token</Label>
              <Input value={apiToken} readOnly className="font-mono text-sm bg-muted" />
            </div>
            <Button variant="outline" onClick={regenerate}>
              Regenerate Token
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Time Tracking</CardTitle>
            <CardDescription>
              Configure how working time is calculated and displayed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Hours per Man-Day</Label>
              <Input
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={hoursPerManDay}
                onChange={(e) => setHoursPerManDay(parseFloat(e.target.value) || 0)}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Used to convert total hours into man-days on the monthly timesheet.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={saveHoursPerManDay}
              disabled={!hoursChanged || saving}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
