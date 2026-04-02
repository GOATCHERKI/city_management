import { useState } from "react";
import "./App.css";
import TopBar from "./components/layout/TopBar.jsx";
import SideNav from "./components/layout/SideNav.jsx";
import AuthCard from "./components/auth/AuthCard.jsx";
import ReportIssueForm from "./components/citizen/ReportIssueForm.jsx";
import MyReports from "./components/citizen/MyReports.jsx";
import AdminDashboard from "./components/admin/AdminDashboard";
import AllIssues from "./components/admin/AllIssues.jsx";
import AssignIssueForm from "./components/admin/AssignIssueForm.jsx";
import AdminAuditLogs from "./components/admin/AdminAuditLogs.jsx";
import AdminUserManagement from "./components/admin/AdminUserManagement.jsx";
import StaffWorkspace from "./components/staff/StaffWorkspace.jsx";
import DeptAdminWorkspace from "./components/deptadmin/DeptAdminWorkspace.jsx";
import { ROLE_NAV_ITEMS, TOKEN_KEY, USER_KEY } from "./constants";

const readStoredJson = (key) => {
  const value = localStorage.getItem(key);
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(() => readStoredJson(USER_KEY));
  const [activeTab, setActiveTab] = useState("report");
  const [citizenRefreshKey, setCitizenRefreshKey] = useState(0);
  const [adminRefreshKey, setAdminRefreshKey] = useState(0);

  const role = user?.role;
  const isAuthenticated = Boolean(token && user);
  const roleNavItems = ROLE_NAV_ITEMS[role] || [];
  const effectiveActiveTab = roleNavItems.some((item) => item.id === activeTab)
    ? activeTab
    : roleNavItems[0]?.id || activeTab;
  const activeNavLabel = roleNavItems.find((item) => item.id === effectiveActiveTab)?.label;

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken("");
    setUser(null);
  };

  return (
    <main className="page-shell">
      <a className="skip-link" href={!isAuthenticated ? "#auth-card" : "#app-main"}>
        Skip to content
      </a>

      <section className="panel">
        <TopBar user={user} isAuthenticated={isAuthenticated} onLogout={logout} />

        {!isAuthenticated ? (
          <AuthCard
            onAuthenticated={({ nextToken, nextUser }) => {
              setToken(nextToken);
              setUser(nextUser);
            }}
          />
        ) : (
          <div className="app-body">
            <SideNav role={role} activeTab={effectiveActiveTab} onTabChange={setActiveTab} />

            <section className="app-content" id="app-main">
              <header className="page-head">
                <h1 className="page-head__title">{activeNavLabel || "Workspace"}</h1>
                <p className="page-head__meta">Official City Portal</p>
              </header>

              {role === "citizen" ? (
                effectiveActiveTab === "report" ? (
                  <ReportIssueForm
                    token={token}
                    onCreated={() => {
                      setCitizenRefreshKey((prev) => prev + 1);
                      setActiveTab("reports");
                    }}
                  />
                ) : (
                  <MyReports token={token} refreshKey={citizenRefreshKey} />
                )
              ) : null}

              {role === "admin" ? (
                effectiveActiveTab === "admin-users" ? (
                  <AdminUserManagement token={token} />
                ) : effectiveActiveTab === "admin-audit" ? (
                  <AdminAuditLogs token={token} />
                ) : effectiveActiveTab === "admin-dashboard" ? (
                  <AdminDashboard token={token} />
                ) : effectiveActiveTab === "admin-assign" ? (
                  <AssignIssueForm
                    token={token}
                    onAssigned={() => {
                      setAdminRefreshKey((prev) => prev + 1);
                      setActiveTab("admin-issues");
                    }}
                  />
                ) : (
                  <AllIssues token={token} refreshKey={adminRefreshKey} canAssign={false} />
                )
              ) : null}

              {role === "staff" ? (
                <StaffWorkspace token={token} activeTab={effectiveActiveTab} onTabChange={setActiveTab} />
              ) : null}

              {role === "dept_admin" ? (
                <DeptAdminWorkspace token={token} user={user} activeTab={effectiveActiveTab} />
              ) : null}

              {!role || !["citizen", "admin", "staff", "dept_admin"].includes(role) ? (
                <p className="info-box">Unknown role: {String(role || "none")}</p>
              ) : null}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
