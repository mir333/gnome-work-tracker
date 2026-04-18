import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "@/lib/auth-client";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { ProjectsPage } from "@/pages/projects";
import { ProjectDetailPage } from "@/pages/project-detail";
import { DashboardPage } from "@/pages/dashboard";
import { SettingsPage } from "@/pages/settings";
import { ProfilePage } from "@/pages/profile";
import { LauncherPage } from "@/pages/launcher";
import { SharedTimesheetPage } from "@/pages/shared-timesheet";
import { OrganisationPage } from "@/pages/organisation";
import { OrgReportPage } from "@/pages/org-report";
import { OrgMemberViewPage } from "@/pages/org-member-view";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  if (isPending) return <div className="p-8">Loading...</div>;
  if (!session) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/launcher"
          element={
            <ProtectedRoute>
              <LauncherPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shared/:token"
          element={
            <ProtectedRoute>
              <SharedTimesheetPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organisation"
          element={
            <ProtectedRoute>
              <OrganisationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organisation/:orgId/report"
          element={
            <ProtectedRoute>
              <OrgReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organisation/:orgId/members/:memberId"
          element={
            <ProtectedRoute>
              <OrgMemberViewPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
