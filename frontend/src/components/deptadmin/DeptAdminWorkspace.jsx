import { useState } from "react";
import DeptAdminBudgets from "./DeptAdminBudgets.jsx";
import DeptAdminDashboard from "./DeptAdminDashboard.jsx";
import DeptAdminIssues from "./DeptAdminIssues.jsx";
import DeptAdminStaff from "./DeptAdminStaff.jsx";

function DeptAdminWorkspace({ token, user, activeTab }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const departmentId = user?.department_id ?? user?.departmentId;

  if (!departmentId) {
    return <p className="info-box">Department not assigned to your account.</p>;
  }

  return (
    <section className="workspace">
      {activeTab === "dept-dashboard" ? (
        <DeptAdminDashboard token={token} departmentId={departmentId} />
      ) : activeTab === "dept-issues" ? (
        <DeptAdminIssues token={token} departmentId={departmentId} refreshKey={refreshKey} />
      ) : activeTab === "dept-budgets" ? (
        <DeptAdminBudgets
          token={token}
          departmentId={departmentId}
          onBudgetUpdated={() => {
            setRefreshKey((prev) => prev + 1);
          }}
        />
      ) : activeTab === "dept-staff" ? (
        <DeptAdminStaff token={token} departmentId={departmentId} />
      ) : null}
    </section>
  );
}

export default DeptAdminWorkspace;