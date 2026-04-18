import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  FolderOpen,
  Building2,
  Rocket,
  User,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";

function NavLink({
  to,
  active,
  icon: Icon,
  children,
}: {
  to: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Opens the Launcher page.
 * If the PWA is installed it tries to hand off to the standalone app,
 * otherwise it opens /launcher in a small popup window.
 */
function openLauncher() {
  const launcherUrl = `${window.location.origin}/launcher`;
  const width = 480;
  const height = 520;
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2);

  window.open(
    launcherUrl,
    "work-tracker-launcher",
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="min-h-screen bg-muted/40">
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-6 gap-1">
          <Link to="/" className="flex items-center gap-2 mr-6">
            <Logo className="h-7 w-auto" />
            <span className="font-bold text-lg tracking-tight hidden sm:inline">
              Work Tracker
            </span>
          </Link>

          <NavLink to="/" active={pathname === "/"} icon={LayoutDashboard}>
            Dashboard
          </NavLink>
          <NavLink
            to="/projects"
            active={pathname.startsWith("/projects")}
            icon={FolderOpen}
          >
            Projects
          </NavLink>
          <NavLink
            to="/organisation"
            active={pathname.startsWith("/organisation")}
            icon={Building2}
          >
            Organisation
          </NavLink>

          <div className="ml-auto flex items-center gap-1">
            {/* Launcher — opens in a new window / PWA */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={openLauncher}
              title="Open Launcher"
            >
              <Rocket className="h-4 w-4" />
            </Button>

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium max-w-[120px] truncate hidden sm:inline">
                    {user?.name || "User"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
