import L from "leaflet";

export const TOKEN_KEY = "city_mgmt_token";
export const USER_KEY = "city_mgmt_user";

export const STATUS_CLASS = {
  pending: "status status-pending",
  in_progress: "status status-progress",
  resolved: "status status-resolved",
};

export const ISTANBUL_CENTER = [41.0082, 28.9784];

export const STATUS_CHART_COLORS = ["#f59e0b", "#2563eb", "#16a34a", "#64748b"];
export const TYPE_CHART_COLORS = [
  "#c2410c",
  "#0f766e",
  "#7c3aed",
  "#d946ef",
  "#0ea5e9",
  "#475569",
];
export const TREND_CHART_COLOR = "#dc2626";
export const ISSUES_PAGE_SIZE = 10;

export const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export const CATEGORY_LABELS = {
  streetlight: "Streetlight",
  pothole: "Pothole",
  garbage: "Garbage",
  water_leak: "Water Leak",
};

export const issueMarkerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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
  dept_admin: [
    { id: "dept-dashboard", label: "Department Dashboard" },
    { id: "dept-issues", label: "Department Issues" },
    { id: "dept-budgets", label: "Department Budgets" },
    { id: "dept-staff", label: "Department Staff" },
  ],
};
