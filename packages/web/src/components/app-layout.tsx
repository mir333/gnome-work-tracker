import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-lg">Work Tracker</span>
        <Link
          to="/"
          className={pathname === "/" ? "font-semibold" : "text-gray-500"}
        >
          Dashboard
        </Link>
        <Link
          to="/projects"
          className={
            pathname.startsWith("/projects") ? "font-semibold" : "text-gray-500"
          }
        >
          Projects
        </Link>
        <Link
          to="/settings"
          className={pathname === "/settings" ? "font-semibold" : "text-gray-500"}
        >
          Settings
        </Link>
        <Link
          to="/launcher"
          className={pathname === "/launcher" ? "font-semibold" : "text-gray-500"}
        >
          Launcher
        </Link>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            Logout
          </Button>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
