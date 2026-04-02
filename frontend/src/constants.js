export const TOKEN_KEY = "city_mgmt_token";
export const USER_KEY = "city_mgmt_user";

export const ROLE_NAV_ITEMS = {
  citizen: [
    { id: "report", label: "Report Issue" },
    { id: "reports", label: "My Reports" },
  ],
  admin: [
    { id: "admin-dashboard", label: "Dashboard" },
    { id: "admin-issues", label: "All Issues" },
    { id: "admin-assign", label: "Departments & Budgets" },
    { id: "admin-users", label: "User Management" },
    { id: "admin-audit", label: "Audit Logs" },
  ],
  staff: [
    { id: "staff-issues", label: "Assigned Issues" },
    { id: "staff-update", label: "Update Status" },
  ],
};
