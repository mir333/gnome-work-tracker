import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSession, authClient } from "@/lib/auth-client";
import { Fingerprint, Plus, Trash2, Monitor, Smartphone } from "lucide-react";

interface PasskeyItem {
  id: string;
  name: string | null;
  credentialID: string;
  deviceType: string;
  backedUp: boolean;
  transports: string | null;
  createdAt: Date | null;
}

export function ProfilePage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  // Passkey state
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [pkLoading, setPkLoading] = useState(false);
  const [pkAdding, setPkAdding] = useState(false);
  const [pkMsg, setPkMsg] = useState("");
  const [pkName, setPkName] = useState("");

  const loadPasskeys = useCallback(async () => {
    setPkLoading(true);
    try {
      const { data } = await authClient.passkey.listUserPasskeys();
      setPasskeys((data as PasskeyItem[]) ?? []);
    } catch {
      // passkeys not available
      setPasskeys([]);
    }
    setPkLoading(false);
  }, []);

  useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setProfileMsg("");
    try {
      const { error } = await authClient.updateUser({ name });
      // Update email if changed
      if (!error && email && email !== user?.email) {
        const { error: emailError } = await authClient.changeEmail({
          newEmail: email,
        });
        if (emailError) {
          setProfileMsg(emailError.message || "Failed to update email");
          setSaving(false);
          return;
        }
      }
      if (error) {
        setProfileMsg(error.message || "Failed to update profile");
      } else {
        setProfileMsg("Profile updated successfully");
      }
    } catch {
      setProfileMsg("Failed to update profile");
    }
    setSaving(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwMsg("Passwords do not match");
      return;
    }
    setPwSaving(true);
    setPwMsg("");
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      if (error) {
        setPwMsg(error.message || "Failed to change password");
      } else {
        setPwMsg("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPwMsg("Failed to change password");
    }
    setPwSaving(false);
  }

  async function handleAddPasskey() {
    setPkAdding(true);
    setPkMsg("");
    try {
      const { error } = await authClient.passkey.addPasskey({
        name: pkName || undefined,
      });
      if (error) {
        setPkMsg(String(error.message || "Failed to register passkey"));
      } else {
        setPkMsg("Passkey registered successfully");
        setPkName("");
        await loadPasskeys();
      }
    } catch (err: any) {
      setPkMsg(err?.message || "Failed to register passkey. Make sure your browser supports WebAuthn.");
    }
    setPkAdding(false);
  }

  async function handleDeletePasskey(id: string) {
    setPkMsg("");
    try {
      const { error } = await authClient.passkey.deletePasskey({ id });
      if (error) {
        setPkMsg(error.message || "Failed to delete passkey");
      } else {
        setPkMsg("Passkey deleted");
        await loadPasskeys();
      }
    } catch {
      setPkMsg("Failed to delete passkey");
    }
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your account details
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your display name and email</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={user?.username || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Username cannot be changed
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {profileMsg && (
                <p
                  className={`text-sm ${
                    profileMsg.includes("success")
                      ? "text-green-600"
                      : "text-destructive"
                  }`}
                >
                  {profileMsg}
                </p>
              )}
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {pwMsg && (
                <p
                  className={`text-sm ${
                    pwMsg.includes("success")
                      ? "text-green-600"
                      : "text-destructive"
                  }`}
                >
                  {pwMsg}
                </p>
              )}
              <Button type="submit" disabled={pwSaving}>
                {pwSaving ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Passkeys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5" />
              Passkeys
            </CardTitle>
            <CardDescription>
              Use biometrics, security keys, or your device to sign in without a
              password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing passkeys list */}
            {pkLoading ? (
              <p className="text-sm text-muted-foreground">Loading passkeys...</p>
            ) : passkeys.length > 0 ? (
              <div className="space-y-3">
                {passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      {pk.deviceType === "singleDevice" ? (
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {pk.name || "Unnamed passkey"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pk.createdAt
                            ? `Added ${new Date(pk.createdAt).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}`
                            : ""}
                          {pk.backedUp && " · Backed up"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeletePasskey(pk.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                No passkeys registered yet. Add one to enable passwordless sign-in.
              </p>
            )}

            <Separator />

            {/* Add new passkey */}
            <div className="space-y-3">
              <Label htmlFor="pkName">Passkey Name (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="pkName"
                  placeholder='e.g. "MacBook Pro", "YubiKey"'
                  value={pkName}
                  onChange={(e) => setPkName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddPasskey}
                  disabled={pkAdding}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {pkAdding ? "Registering..." : "Add Passkey"}
                </Button>
              </div>
            </div>

            {pkMsg && (
              <p
                className={`text-sm ${
                  pkMsg.includes("success") || pkMsg.includes("deleted")
                    ? "text-green-600"
                    : "text-destructive"
                }`}
              >
                {pkMsg}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
