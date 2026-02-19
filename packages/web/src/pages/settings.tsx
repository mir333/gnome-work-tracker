import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <Card>
          <CardHeader>
            <CardTitle>API Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-500">
              Use this token to configure the GNOME extension or trigger URLs.
            </p>
            <div>
              <Label>Your Token</Label>
              <Input value={apiToken} readOnly className="font-mono text-sm" />
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
