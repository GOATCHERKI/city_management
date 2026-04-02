import { useState } from "react";
import AllIssues from "../admin/AllIssues.jsx";
import UpdateStatusForm from "./UpdateStatusForm.jsx";

function StaffWorkspace({ token, activeTab, onTabChange }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="workspace">
      {activeTab === "staff-update" ? (
        <UpdateStatusForm
          token={token}
          onUpdated={() => {
            setRefreshKey((prev) => prev + 1);
            onTabChange("staff-issues");
          }}
        />
      ) : (
        <AllIssues token={token} refreshKey={refreshKey} canAssign={false} />
      )}
    </section>
  );
}

export default StaffWorkspace;