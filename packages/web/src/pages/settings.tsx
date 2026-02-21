import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";

export function SettingsPage() {
  const [apiToken, setApiToken] = useState("");

  async function load() {
    const data = await api.get("/profile");
    setApiToken(data.apiToken);
  }

  useEffect(() => {
    load();
  }, []);

  async function regenerate() {
    const data = await api.post("/profile/regenerate-token", {});
    setApiToken(data.apiToken);
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
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
      </div>
    </AppLayout>
  );
}
