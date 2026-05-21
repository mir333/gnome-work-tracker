import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/lib/auth-client";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  Plus,
  X,
  BarChart3,
  Shield,
  UserMinus,
  ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Organisation {
  id: string;
  name: string;
  ownerId: string;
  owner: { id: string; name: string };
  _count: { members: number };
}

interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    username: string | null;
    displayUsername: string | null;
  };
}

interface OrgInvite {
  id: string;
  targetUser: { id: string; name: string; username: string | null; displayUsername: string | null };
  inviter: { id: string; name: string };
}

interface PendingInvite {
  id: string;
  organisation: { id: string; name: string };
  inviter: { id: string; name: string };
}

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  manager:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  member:
    "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OrganisationPage() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const currentUser = session?.user;

  // Organisation list
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // Members & invites for the selected org
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [orgInvites, setOrgInvites] = useState<OrgInvite[]>([]);

  // My pending invites from other orgs
  const [myInvites, setMyInvites] = useState<PendingInvite[]>([]);

  // Create org dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");

  // Invite member dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Derived
  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? null;
  const myRole =
    members.find((m) => m.userId === currentUser?.id)?.role ?? null;
  const isOwnerOrManager = myRole === "owner" || myRole === "manager";

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const loadOrgs = useCallback(async () => {
    const data = await api.get("/organisations");
    setOrgs(data);
    // auto-select first if nothing selected
    if (data.length > 0 && !selectedOrgId) {
      setSelectedOrgId(data[0].id);
    }
  }, [selectedOrgId]);

  const loadMyInvites = useCallback(async () => {
    try {
      const data = await api.get("/invites");
      setMyInvites(data);
    } catch {
      setMyInvites([]);
    }
  }, []);

  const loadOrgDetails = useCallback(async (orgId: string) => {
    const [memberData] = await Promise.all([
      api.get(`/organisations/${orgId}/members`),
    ]);
    setMembers(memberData);

    // Try to load pending invites (will fail for regular members — that's OK)
    try {
      const inv = await api.get(`/organisations/${orgId}/invites`);
      setOrgInvites(inv);
    } catch {
      setOrgInvites([]);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
    loadMyInvites();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      loadOrgDetails(selectedOrgId);
    }
  }, [selectedOrgId, loadOrgDetails]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    const org = await api.post("/organisations", { name: newOrgName });
    setNewOrgName("");
    setCreateOpen(false);
    await loadOrgs();
    setSelectedOrgId(org.id);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrgId) return;
    setInviteError(null);
    try {
      await api.post(`/organisations/${selectedOrgId}/invites`, {
        username: inviteUsername,
      });
      setInviteUsername("");
      setInviteOpen(false);
      loadOrgDetails(selectedOrgId);
    } catch (err: any) {
      setInviteError(err.message || "Failed to send invite");
    }
  }

  async function handleCancelInvite(inviteId: string) {
    if (!selectedOrgId) return;
    await api.delete(`/organisations/${selectedOrgId}/invites/${inviteId}`);
    loadOrgDetails(selectedOrgId);
  }

  async function handleAcceptInvite(inviteId: string) {
    await api.post(`/invites/${inviteId}/accept`, {});
    await loadMyInvites();
    await loadOrgs();
  }

  async function handleDeclineInvite(inviteId: string) {
    await api.post(`/invites/${inviteId}/decline`, {});
    await loadMyInvites();
  }

  async function handleChangeRole(memberId: string, role: string) {
    if (!selectedOrgId) return;
    await api.put(`/organisations/${selectedOrgId}/members/${memberId}/role`, {
      role,
    });
    loadOrgDetails(selectedOrgId);
  }

  async function handleRemoveMember(memberId: string) {
    if (!selectedOrgId) return;
    await api.delete(`/organisations/${selectedOrgId}/members/${memberId}`);
    loadOrgDetails(selectedOrgId);
    loadOrgs();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* ================================================================ */}
        {/* PENDING INVITATIONS BANNER                                       */}
        {/* ================================================================ */}
        {myInvites.length > 0 && (
          <Card className="mb-6 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700">
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-3">
                Pending Invitations
              </h3>
              <div className="space-y-2">
                {myInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">
                      <span className="font-medium">
                        {inv.organisation.name}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        — invited by {inv.inviter.name}
                      </span>
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptInvite(inv.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeclineInvite(inv.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ================================================================ */}
        {/* HEADER + CREATE ORG                                              */}
        {/* ================================================================ */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Organisation</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your team and view reports
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Organisation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Organisation</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organisation Name</Label>
                  <Input
                    id="orgName"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="My Team"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Create
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* ================================================================ */}
        {/* ORG SELECTOR (when user is in multiple orgs)                     */}
        {/* ================================================================ */}
        {orgs.length > 1 && (
          <div className="mb-6">
            <Select
              value={selectedOrgId ?? undefined}
              onValueChange={setSelectedOrgId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select organisation" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name} ({org._count.members} members)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ================================================================ */}
        {/* EMPTY STATE                                                      */}
        {/* ================================================================ */}
        {orgs.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Create an organisation to get started, or wait for an invitation.
            </CardContent>
          </Card>
        )}

        {/* ================================================================ */}
        {/* SELECTED ORG DETAILS                                             */}
        {/* ================================================================ */}
        {selectedOrg && (
          <>
            {/* Org header card */}
            <Card className="mb-6">
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{selectedOrg.name}</h2>
                  {myRole && (
                    <Badge
                      variant="secondary"
                      className={ROLE_COLORS[myRole] ?? ""}
                    >
                      {myRole}
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {selectedOrg._count.members} member
                    {selectedOrg._count.members !== 1 ? "s" : ""}
                  </span>
                </div>
                {isOwnerOrManager && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(`/organisation/${selectedOrg.id}/report`)
                      }
                    >
                      <BarChart3 className="mr-2 h-4 w-4" />
                      View Report
                    </Button>
                    <Button onClick={() => setInviteOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Invite
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending org invites (owner/manager only) */}
            {orgInvites.length > 0 && isOwnerOrManager && (
              <Card className="mb-4">
                <CardContent className="py-4">
                  <h3 className="text-sm font-semibold mb-3">
                    Pending Invites
                  </h3>
                  <div className="space-y-2">
                    {orgInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between py-1"
                      >
                        <span className="text-sm">
                          {inv.targetUser.name}
                          {inv.targetUser.displayUsername && (
                            <span className="text-muted-foreground ml-1">
                              @{inv.targetUser.displayUsername}
                            </span>
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleCancelInvite(inv.id)}
                          title="Cancel invite"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Members table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow
                      key={member.userId}
                      className={
                        isOwnerOrManager
                          ? "cursor-pointer"
                          : ""
                      }
                      onClick={() => {
                        if (isOwnerOrManager) {
                          navigate(
                            `/organisation/${selectedOrg.id}/members/${member.userId}`
                          );
                        }
                      }}
                    >
                      <TableCell>
                        <span className="font-medium">{member.user.name}</span>
                        {member.user.displayUsername && (
                          <span className="text-muted-foreground text-xs ml-2">
                            @{member.user.displayUsername}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={ROLE_COLORS[member.role] ?? ""}
                        >
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Role change dropdown — owner only, can't change self */}
                          {myRole === "owner" &&
                            member.userId !== currentUser?.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Change role"
                                  >
                                    <Shield className="h-3.5 w-3.5 mr-1" />
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleChangeRole(
                                        member.userId,
                                        "manager"
                                      )
                                    }
                                    disabled={member.role === "manager"}
                                  >
                                    Promote to Manager
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleChangeRole(
                                        member.userId,
                                        "member"
                                      )
                                    }
                                    disabled={member.role === "member"}
                                  >
                                    Set as Member
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}

                          {/* Remove member — owner/manager can remove others, anyone can leave */}
                          {member.role !== "owner" &&
                            (isOwnerOrManager ||
                              member.userId === currentUser?.id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() =>
                                  handleRemoveMember(member.userId)
                                }
                                title={
                                  member.userId === currentUser?.id
                                    ? "Leave organisation"
                                    : "Remove member"
                                }
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}

        {/* ================================================================ */}
        {/* INVITE DIALOG                                                    */}
        {/* ================================================================ */}
        <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) setInviteError(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteUsername">Username</Label>
                <Input
                  id="inviteUsername"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                />
              </div>
              {inviteError && (
                <p className="text-sm text-destructive">{inviteError}</p>
              )}
              <Button type="submit" className="w-full">
                Send Invite
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
