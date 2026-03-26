import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "./App.css";
import MapPicker from "./components/MapPicker.jsx";
import { API_BASE_URL, apiRequest } from "./api.js";
import TopBar from "./components/layout/TopBar.jsx";
import SideNav from "./components/layout/SideNav.jsx";
import AuthCard from "./components/auth/AuthCard.jsx";
import { ROLE_NAV_ITEMS, TOKEN_KEY, USER_KEY } from "./constants.js";

const STATUS_CLASS = {
  pending: "status status-pending",
  in_progress: "status status-progress",
  resolved: "status status-resolved",
};

const ISTANBUL_CENTER = [41.0082, 28.9784];

const issueMarkerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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
                <CitizenWorkspace
                  token={token}
                  activeTab={effectiveActiveTab}
                  onTabChange={setActiveTab}
                />
              ) : null}

              {role === "admin" ? (
                <AdminWorkspace
                  token={token}
                  activeTab={effectiveActiveTab}
                  onTabChange={setActiveTab}
                />
              ) : null}

              {role === "staff" ? (
                <StaffWorkspace
                  token={token}
                  activeTab={effectiveActiveTab}
                  onTabChange={setActiveTab}
                />
              ) : null}

              {!role || !["citizen", "admin", "staff"].includes(role) ? (
                <p className="info-box">Unknown role: {String(role || "none")}</p>
              ) : null}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function CitizenWorkspace({ token, activeTab, onTabChange }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="workspace">
      {activeTab === "report" ? (
        <ReportIssueForm
          token={token}
          onCreated={() => {
            setRefreshKey((prev) => prev + 1);
            onTabChange("reports");
          }}
        />
      ) : (
        <MyReports token={token} refreshKey={refreshKey} />
      )}
    </section>
  );
}

function ReportIssueForm({ token, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("streetlight");
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const canSubmit = useMemo(
    () => Boolean(title && description && category && location.lat && location.lng),
    [category, description, location.lat, location.lng, title],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setFeedback("");

    try {
      let photoUrl;
      if (file) {
        const formData = new FormData();
        formData.append("image", file);

        const upload = await apiRequest({
          path: "/issues/upload-image",
          method: "POST",
          token,
          body: formData,
          isFormData: true,
        });
        photoUrl = upload.photo_url;
      }

      await apiRequest({
        path: "/issues",
        method: "POST",
        token,
        body: {
          title,
          description,
          category,
          latitude: location.lat,
          longitude: location.lng,
          photo_url: photoUrl,
        },
      });

      setFeedback("Issue submitted successfully.");
      setTitle("");
      setDescription("");
      setCategory("streetlight");
      setLocation({ lat: null, lng: null });
      setFile(null);
      onCreated();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>

      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="streetlight">Streetlight</option>
          <option value="pothole">Pothole</option>
          <option value="garbage">Garbage</option>
          <option value="water_leak">Water Leak</option>
        </select>
      </label>

      <label className="full-width">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          required
        />
      </label>

      <label className="full-width">
        Photo (optional)
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>

      <div className="full-width">
        <p className="hint">Click map to set location.</p>
        <MapPicker value={location} onChange={setLocation} />
        <p className="coords">
          Latitude: <strong>{location.lat ?? "-"}</strong> | Longitude: <strong>{location.lng ?? "-"}</strong>
        </p>
      </div>

      <button className="solid-btn" disabled={!canSubmit || loading}>
        {loading ? "Submitting..." : "Submit Issue"}
      </button>

      {feedback ? <p className="feedback">{feedback}</p> : null}
    </form>
  );
}

function MyReports({ token, refreshKey }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const mappedIssues = useMemo(() => {
    return issues
      .map((item) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          ...item,
          lat,
          lng,
        };
      })
      .filter(Boolean);
  }, [issues]);

  const mapCenter = useMemo(() => {
    if (!mappedIssues.length) return ISTANBUL_CENTER;
    const sum = mappedIssues.reduce(
      (acc, item) => ({ lat: acc.lat + item.lat, lng: acc.lng + item.lng }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / mappedIssues.length, sum.lng / mappedIssues.length];
  }, [mappedIssues]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await apiRequest({ path: "/issues/my", token });
        if (mounted) {
          setIssues(result.issues || []);
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [refreshKey, token]);

  if (loading) return <p className="info-box">Loading reports...</p>;
  if (error) return <p className="info-box">{error}</p>;
  if (!issues.length) return <p className="info-box">No reports yet.</p>;

  return (
    <section className="all-issues-layout">
      {mappedIssues.length ? (
        <section className="all-issues-map-card" aria-label="My reports map">
          <div className="all-issues-map-head">
            <h3>My Reports Map</h3>
            <p>{mappedIssues.length} mapped reports</p>
          </div>
          <MapContainer
            key={`my-reports-map-${mappedIssues.length}`}
            center={mapCenter}
            zoom={11}
            scrollWheelZoom
            className="all-issues-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mappedIssues.map((item) => (
              <Marker key={item.id} position={[item.lat, item.lng]} icon={issueMarkerIcon}>
                <Popup>
                  <strong>{item.title}</strong>
                  <br />
                  Status: {item.status}
                  <br />
                  Category: {item.category}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </section>
      ) : null}

      <div className="report-list">
        {issues.map((item) => (
          <article className="report-card" key={item.id}>
            <div className="report-head">
              <h3>{item.title}</h3>
              <span className={STATUS_CLASS[item.status] || "status"}>{item.status}</span>
            </div>
            <p>{item.description}</p>
            <div className="meta-row">
              <span>Category: {item.category}</span>
              <span>
                Coords: {item.latitude}, {item.longitude}
              </span>
            </div>
            <div className="meta-row">
              <span>Department: {item.assigned_department_name || "Unassigned"}</span>
              <span>{new Date(item.created_at).toLocaleString()}</span>
            </div>
            {item.photo_url ? (
              <img
                src={item.photo_url}
                alt={`Issue ${item.id}`}
                className="issue-photo"
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : null}
            {item.photo_url ? (
              <a href={item.photo_url} target="_blank" rel="noreferrer" className="photo-link">
                View Photo
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminWorkspace({ token, activeTab, onTabChange }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="workspace">
      {activeTab === "admin-users" ? (
        <AdminUserManagement token={token} />
      ) : activeTab === "admin-audit" ? (
        <AdminAuditLogs token={token} />
      ) : activeTab === "admin-dashboard" ? (
        <AdminDashboard token={token} />
      ) : activeTab === "admin-assign" ? (
        <AssignIssueForm
          token={token}
          onAssigned={() => {
            setRefreshKey((prev) => prev + 1);
            onTabChange("admin-issues");
          }}
        />
      ) : (
        <AllIssues token={token} refreshKey={refreshKey} canAssign={false} />
      )}
    </section>
  );
}

function AdminDashboard({ token }) {
  const [stats, setStats] = useState({
    range: "7d",
    totalUsers: 0,
    activeDepartments: 0,
    actionsLast24h: 0,
    actionBreakdown: {
      "user.create": 0,
      "user.role.update": 0,
      "user.department.update": 0,
    },
    recentActions: [],
  });
  const [range, setRange] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      setLoading(true);
      setFeedback("");
      try {
        const result = await apiRequest({
          path: `/admin/dashboard?range=${encodeURIComponent(range)}`,
          token,
        });
        if (mounted) {
          setStats({
            range: result.range || range,
            totalUsers: Number(result.totalUsers || 0),
            activeDepartments: Number(result.activeDepartments || 0),
            actionsLast24h: Number(result.actionsLast24h || 0),
            actionBreakdown: {
              "user.create": Number(result.actionBreakdown?.["user.create"] || 0),
              "user.role.update": Number(result.actionBreakdown?.["user.role.update"] || 0),
              "user.department.update": Number(
                result.actionBreakdown?.["user.department.update"] || 0,
              ),
            },
            recentActions: result.recentActions || [],
          });
        }
      } catch (error) {
        if (mounted) {
          setFeedback(error.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadStats();
    return () => {
      mounted = false;
    };
  }, [token, range]);

  return (
    <section className="admin-grid">
      <section className="card-box full-width">
        <h3>Admin Dashboard</h3>
        <label className="dashboard-range">
          Date Range
          <select value={range} onChange={(event) => setRange(event.target.value)}>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </label>
        {loading ? <p className="info-box">Loading dashboard...</p> : null}
        {feedback ? <p className="feedback">{feedback}</p> : null}

        {!loading && !feedback ? (
          <div className="dashboard-stats">
            <article className="stat-card">
              <p className="stat-label">Total Users</p>
              <p className="stat-value">{stats.totalUsers}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Active Departments</p>
              <p className="stat-value">{stats.activeDepartments}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Actions Last 24 Hours</p>
              <p className="stat-value">{stats.actionsLast24h}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">user.create ({stats.range})</p>
              <p className="stat-value">{stats.actionBreakdown["user.create"]}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">user.role.update ({stats.range})</p>
              <p className="stat-value">{stats.actionBreakdown["user.role.update"]}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">user.department.update ({stats.range})</p>
              <p className="stat-value">{stats.actionBreakdown["user.department.update"]}</p>
            </article>
          </div>
        ) : null}
      </section>

      <section className="card-box full-width">
        <h3>Recent Audit Actions</h3>
        {!loading && !feedback && !stats.recentActions.length ? (
          <p className="info-box">No audit actions yet.</p>
        ) : null}

        {!loading && !feedback && stats.recentActions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentActions.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.created_at).toLocaleString()}</td>
                    <td>{entry.action}</td>
                    <td>{entry.actor_cid || "-"}</td>
                    <td>{entry.target_cid || `#${entry.target_user_id || "-"}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  );
}

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

function AllIssues({ token, refreshKey }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const mappedIssues = useMemo(() => {
    return issues
      .map((item) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          ...item,
          lat,
          lng,
        };
      })
      .filter(Boolean);
  }, [issues]);

  const mapCenter = useMemo(() => {
    if (!mappedIssues.length) return ISTANBUL_CENTER;
    const sum = mappedIssues.reduce(
      (acc, item) => ({ lat: acc.lat + item.lat, lng: acc.lng + item.lng }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / mappedIssues.length, sum.lng / mappedIssues.length];
  }, [mappedIssues]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await apiRequest({ path: "/issues", token });
        if (mounted) {
          setIssues(result.issues || []);
        }
      } catch (fetchError) {
        if (mounted) setError(fetchError.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [refreshKey, token]);

  if (loading) return <p className="info-box">Loading issues...</p>;
  if (error) return <p className="info-box">{error}</p>;
  if (!issues.length) return <p className="info-box">No issues available.</p>;

  return (
    <section className="all-issues-layout">
      {mappedIssues.length ? (
        <section className="all-issues-map-card" aria-label="Issues map">
          <div className="all-issues-map-head">
            <h3>Issues Map</h3>
            <p>{mappedIssues.length} mapped issues</p>
          </div>
          <MapContainer
            key={`issues-map-${mappedIssues.length}`}
            center={mapCenter}
            zoom={11}
            scrollWheelZoom
            className="all-issues-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mappedIssues.map((item) => (
              <Marker key={item.id} position={[item.lat, item.lng]} icon={issueMarkerIcon}>
                <Popup>
                  <strong>#{item.id} {item.title}</strong>
                  <br />
                  Status: {item.status}
                  <br />
                  Category: {item.category}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </section>
      ) : null}

      <div className="report-list">
        {issues.map((item) => (
          <article className="report-card" key={item.id}>
            <div className="report-head">
              <h3>#{item.id} {item.title}</h3>
              <span className={STATUS_CLASS[item.status] || "status"}>{item.status}</span>
            </div>
            <p>{item.description}</p>
            <div className="meta-row">
              <span>Category: {item.category}</span>
              <span>
                Coords: {item.latitude}, {item.longitude}
              </span>
            </div>
            <div className="meta-row">
              <span>Created by: {item.created_by_name || item.created_by}</span>
              <span>Department: {item.assigned_department_name || "Unassigned"}</span>
            </div>
            {item.photo_url ? (
              <img
                src={item.photo_url}
                alt={`Issue ${item.id}`}
                className="issue-photo"
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : null}
            {item.photo_url ? (
              <a href={item.photo_url} target="_blank" rel="noreferrer" className="photo-link">
                View Photo
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function AssignIssueForm({ token, onAssigned }) {
  const [issueId, setIssueId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadDepartments = async () => {
      try {
        const result = await apiRequest({ path: "/issues/departments", token });
        if (mounted) setDepartments(result.departments || []);
      } catch (error) {
        if (mounted) setFeedback(error.message);
      }
    };

    loadDepartments();
    return () => {
      mounted = false;
    };
  }, [token]);

  const submitAssign = async (event) => {
    event.preventDefault();
    setLoading(true);
    setFeedback("");
    try {
      await apiRequest({
        path: `/issues/${issueId}/assign`,
        method: "PATCH",
        token,
        body: { departmentId: Number(departmentId) },
      });
      setFeedback("Issue assigned successfully.");
      setIssueId("");
      setDepartmentId("");
      onAssigned();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submitAssign}>
      <label>
        Issue ID
        <input
          value={issueId}
          onChange={(event) => setIssueId(event.target.value)}
          placeholder="e.g. 12"
          required
        />
      </label>

      <label>
        Department
        <select
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
          required
        >
          <option value="">Select department</option>
          {departments.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <button className="solid-btn" disabled={loading}>
        {loading ? "Assigning..." : "Assign Issue"}
      </button>

      {feedback ? <p className="feedback">{feedback}</p> : null}
    </form>
  );
}

function UpdateStatusForm({ token, onUpdated }) {
  const [issueId, setIssueId] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const submitUpdate = async (event) => {
    event.preventDefault();
    setLoading(true);
    setFeedback("");
    try {
      await apiRequest({
        path: `/issues/${issueId}/status`,
        method: "PATCH",
        token,
        body: {
          status,
          message: message || undefined,
        },
      });
      setFeedback("Issue status updated.");
      setIssueId("");
      setMessage("");
      onUpdated();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submitUpdate}>
      <label>
        Issue ID
        <input
          value={issueId}
          onChange={(event) => setIssueId(event.target.value)}
          placeholder="e.g. 12"
          required
        />
      </label>

      <label>
        New Status
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>

      <label className="full-width">
        Update Message (optional)
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          placeholder="Technician visited site..."
        />
      </label>

      <button className="solid-btn" disabled={loading}>
        {loading ? "Updating..." : "Update Status"}
      </button>

      {feedback ? <p className="feedback">{feedback}</p> : null}
    </form>
  );
}

function AdminUserManagement({ token }) {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  const [newUser, setNewUser] = useState({
    cid: "",
    fullName: "",
    email: "",
    password: "",
    role: "staff",
    departmentId: "",
  });

  const [roleUpdate, setRoleUpdate] = useState({ userId: "", role: "staff", departmentId: "" });
  const [deptUpdate, setDeptUpdate] = useState({ userId: "", departmentId: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback("");
    try {
      const [userResult, departmentResult] = await Promise.all([
        apiRequest({ path: "/admin/users", token }),
        apiRequest({ path: "/issues/departments", token }),
      ]);
      setUsers(userResult.users || []);
      setDepartments(departmentResult.departments || []);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createUser = async (event) => {
    event.preventDefault();
    setFeedback("");
    try {
      await apiRequest({
        path: "/admin/users",
        method: "POST",
        token,
        body: {
          cid: newUser.cid,
          fullName: newUser.fullName,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          departmentId: newUser.role === "staff" ? Number(newUser.departmentId) : null,
        },
      });
      setFeedback("User created successfully.");
      setNewUser({
        cid: "",
        fullName: "",
        email: "",
        password: "",
        role: "staff",
        departmentId: "",
      });
      await loadData();
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const submitRoleUpdate = async (event) => {
    event.preventDefault();
    setFeedback("");
    try {
      await apiRequest({
        path: `/admin/users/${roleUpdate.userId}/role`,
        method: "PATCH",
        token,
        body: {
          role: roleUpdate.role,
          departmentId: roleUpdate.role === "staff" ? Number(roleUpdate.departmentId) : null,
        },
      });
      setFeedback("User role updated.");
      await loadData();
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const submitDepartmentUpdate = async (event) => {
    event.preventDefault();
    setFeedback("");
    try {
      await apiRequest({
        path: `/admin/users/${deptUpdate.userId}/department`,
        method: "PATCH",
        token,
        body: {
          departmentId: deptUpdate.departmentId ? Number(deptUpdate.departmentId) : null,
        },
      });
      setFeedback("Staff department updated.");
      await loadData();
    } catch (error) {
      setFeedback(error.message);
    }
  };

  return (
    <section className="admin-grid">
      <form className="form-grid card-box" onSubmit={createUser}>
        <h3 className="full-width">Create User</h3>
        <label>
          CID
          <input
            value={newUser.cid}
            onChange={(e) => setNewUser((prev) => ({ ...prev, cid: e.target.value }))}
            required
          />
        </label>
        <label>
          Full Name
          <input
            value={newUser.fullName}
            onChange={(e) => setNewUser((prev) => ({ ...prev, fullName: e.target.value }))}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
        </label>
        <label>
          Temp Password
          <input
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
            required
          />
        </label>
        <label>
          Role
          <select
            value={newUser.role}
            onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
          >
            <option value="citizen">Citizen</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>
          Department (for staff)
          <select
            value={newUser.departmentId}
            onChange={(e) => setNewUser((prev) => ({ ...prev, departmentId: e.target.value }))}
          >
            <option value="">Select department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <button className="solid-btn">Create User</button>
      </form>

      <form className="form-grid card-box role-update-form" onSubmit={submitRoleUpdate}>
        <h3 className="full-width">Change User Role</h3>
        <label>
          User
          <select
            value={roleUpdate.userId}
            onChange={(e) => setRoleUpdate((prev) => ({ ...prev, userId: e.target.value }))}
            required
          >
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                #{user.id} {user.cid} ({user.role})
              </option>
            ))}
          </select>
        </label>
        <label>
          New Role
          <select
            value={roleUpdate.role}
            onChange={(e) => setRoleUpdate((prev) => ({ ...prev, role: e.target.value }))}
          >
            <option value="citizen">Citizen</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>
          Department (staff)
          <select
            value={roleUpdate.departmentId}
            onChange={(e) => setRoleUpdate((prev) => ({ ...prev, departmentId: e.target.value }))}
          >
            <option value="">Select department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <button className="solid-btn user-role-update-btn">Update Role</button>
      </form>

      <form className="form-grid card-box" onSubmit={submitDepartmentUpdate}>
        <h3 className="full-width">Assign Staff Department</h3>
        <label>
          Staff User
          <select
            value={deptUpdate.userId}
            onChange={(e) => setDeptUpdate((prev) => ({ ...prev, userId: e.target.value }))}
            required
          >
            <option value="">Select staff user</option>
            {users
              .filter((user) => user.role === "staff")
              .map((user) => (
                <option key={user.id} value={user.id}>
                  #{user.id} {user.cid}
                </option>
              ))}
          </select>
        </label>
        <label>
          Department
          <select
            value={deptUpdate.departmentId}
            onChange={(e) => setDeptUpdate((prev) => ({ ...prev, departmentId: e.target.value }))}
            required
          >
            <option value="">Select department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <button className="solid-btn">Update Department</button>
      </form>

      <section className="card-box full-width">
        <h3>Users</h3>
        {loading ? <p className="info-box">Loading users...</p> : null}
        {!loading ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>CID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.cid}</td>
                    <td>{user.full_name}</td>
                    <td>{user.role}</td>
                    <td>{user.department_name || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {feedback ? <p className="feedback full-width">{feedback}</p> : null}
    </section>
  );
}

function AdminAuditLogs({ token }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [expandedRowId, setExpandedRowId] = useState(null);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [action, setAction] = useState("");
  const [actorCid, setActorCid] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  const buildAuditParams = useCallback(
    ({
      nextQ = debouncedQ,
      nextAction = action,
      nextActorCid = actorCid,
      nextFrom = from,
      nextTo = to,
      nextLimit = limit,
      nextOffset = offset,
      format,
    } = {}) => {
      const params = new URLSearchParams();
      params.set("limit", String(nextLimit));
      params.set("offset", String(nextOffset));
      if (nextQ.trim()) {
        params.set("q", nextQ.trim());
      }
      if (nextActorCid.trim()) {
        params.set("actorCid", nextActorCid.trim());
      }
      if (nextAction) {
        params.set("action", nextAction);
      }
      if (nextFrom) {
        params.set("from", nextFrom);
      }
      if (nextTo) {
        params.set("to", nextTo);
      }
      if (format) {
        params.set("format", format);
      }
      return params;
    },
    [debouncedQ, action, actorCid, from, to, limit, offset],
  );

  const loadLogs = useCallback(
    async ({
      resetOffset = false,
      nextQ = debouncedQ,
      nextAction = action,
      nextActorCid = actorCid,
      nextFrom = from,
      nextTo = to,
      nextLimit = limit,
      nextOffset = offset,
    } = {}) => {
      const effectiveOffset = resetOffset ? 0 : nextOffset;
      setLoading(true);
      setFeedback("");

      try {
        const params = buildAuditParams({
          nextQ,
          nextAction,
          nextActorCid,
          nextFrom,
          nextTo,
          nextLimit,
          nextOffset: effectiveOffset,
        });

        const result = await apiRequest({
          path: `/admin/audit-logs?${params.toString()}`,
          token,
        });

        setLogs(result.logs || []);
        setTotal(Number(result.total || 0));
        if (resetOffset) {
          setOffset(0);
        }
      } catch (error) {
        setFeedback(error.message);
      } finally {
        setLoading(false);
      }
    },
    [debouncedQ, action, actorCid, from, to, limit, offset, token, buildAuditParams],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQ(q);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [q]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (q === debouncedQ) {
      return;
    }

    loadLogs({
      resetOffset: true,
      nextQ: debouncedQ,
      nextOffset: 0,
    });
  }, [debouncedQ, q, loadLogs]);

  const canGoPrev = offset > 0;
  const canGoNext = offset + logs.length < total;

  const exportCsv = async () => {
    try {
      setFeedback("");
      const params = buildAuditParams({ format: "csv" });
      const response = await fetch(`${API_BASE_URL}/admin/audit-logs?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let payload;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        throw new Error(payload?.message || "Failed to export CSV");
      }

      const csvText = await response.text();
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `admin-audit-logs-${now}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const applyFilters = async (event) => {
    event.preventDefault();
    await loadLogs({ resetOffset: true, nextOffset: 0 });
  };

  const goPrev = async () => {
    if (!canGoPrev) return;
    setOffset((prev) => Math.max(0, prev - Number(limit)));
  };

  const goNext = async () => {
    if (!canGoNext) return;
    setOffset((prev) => prev + Number(limit));
  };

  return (
    <section className="admin-grid">
      <form className="form-grid card-box full-width" onSubmit={applyFilters}>
        <h3 className="full-width">Audit Log Filters</h3>
        <label>
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor, action, or target"
          />
        </label>

        <label>
          Action
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            <option value="user.create">user.create</option>
            <option value="user.role.update">user.role.update</option>
            <option value="user.department.update">user.department.update</option>
          </select>
        </label>

        <label>
          Actor CID
          <input
            value={actorCid}
            onChange={(e) => setActorCid(e.target.value)}
            placeholder="Filter by actor CID"
          />
        </label>

        <label>
          From Date
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>

        <label>
          To Date
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>

        <label>
          Page Size
          <select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>

        <div className="audit-actions">
          <button className="solid-btn" type="submit">
            Apply Filters
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={async () => {
              setQ("");
              setDebouncedQ("");
              setAction("");
              setActorCid("");
              setFrom("");
              setTo("");
              setLimit(25);
              setOffset(0);
              await loadLogs({
                resetOffset: true,
                nextQ: "",
                nextAction: "",
                nextActorCid: "",
                nextFrom: "",
                nextTo: "",
                nextLimit: 25,
                nextOffset: 0,
              });
            }}
          >
            Clear All Filters
          </button>
          <button className="ghost-btn" type="button" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </form>

      <section className="card-box full-width">
        <h3>Audit Logs</h3>
        {loading ? <p className="info-box">Loading audit logs...</p> : null}
        {feedback ? <p className="feedback">{feedback}</p> : null}

        {!loading && !feedback ? (
          <>
            {!logs.length ? (
              <p className="info-box">No audit logs found for current filters.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Target User</th>
                      <th>Changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((entry) => {
                      const isExpanded = expandedRowId === entry.id;
                      return (
                        <Fragment key={entry.id}>
                          <tr
                            className="audit-row"
                            onClick={() => {
                              setExpandedRowId((prev) => (prev === entry.id ? null : entry.id));
                            }}
                          >
                            <td>{new Date(entry.created_at).toLocaleString()}</td>
                            <td>{entry.action}</td>
                            <td>{entry.actor_cid || `#${entry.actor_user_id || "-"}`}</td>
                            <td>{entry.target_cid || `#${entry.target_user_id || "-"}`}</td>
                            <td>{isExpanded ? "Hide Details" : "Show Details"}</td>
                          </tr>
                          {isExpanded ? (
                            <tr className="audit-detail-row">
                              <td colSpan={5}>
                                <div className="audit-detail-grid">
                                  <div className="json-panel">
                                    <h4>Old Values</h4>
                                    <pre className="json-cell json-block">
                                      {entry.old_values
                                        ? JSON.stringify(entry.old_values, null, 2)
                                        : "-"}
                                    </pre>
                                  </div>
                                  <div className="json-panel">
                                    <h4>New Values</h4>
                                    <pre className="json-cell json-block">
                                      {entry.new_values
                                        ? JSON.stringify(entry.new_values, null, 2)
                                        : "-"}
                                    </pre>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="audit-pagination">
              <button className="ghost-btn" type="button" disabled={!canGoPrev} onClick={goPrev}>
                Previous
              </button>
              <span>
                Offset {offset} - showing {logs.length} of {total} entries
              </span>
              <button className="ghost-btn" type="button" disabled={!canGoNext} onClick={goNext}>
                Next
              </button>
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}

export default App;
