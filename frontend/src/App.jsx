import { useEffect, useMemo, useState } from "react";
import "./App.css";
import MapPicker from "./components/MapPicker.jsx";
import { apiRequest } from "./api.js";

const TOKEN_KEY = "city_mgmt_token";
const USER_KEY = "city_mgmt_user";

const STATUS_CLASS = {
  pending: "status status-pending",
  in_progress: "status status-progress",
  resolved: "status status-resolved",
};

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

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken("");
    setUser(null);
  };

  return (
    <main className="page-shell">
      <section className="panel">
        <header className="hero">
          <p className="eyebrow">Smart City Management</p>
          <h1>Role-Based Issue Workflow</h1>
          <p>
            Citizens report issues, admins assign departments, and staff update field status.
          </p>
        </header>

        {!token || !user ? (
          <AuthCard
            onAuthenticated={({ nextToken, nextUser }) => {
              setToken(nextToken);
              setUser(nextUser);
            }}
          />
        ) : (
          <>
            <div className="session-strip">
              <div>
                <strong>{user.fullName || user.full_name || user.cid}</strong>
                <span className="role-chip">Role: {user.role}</span>
              </div>
              <button className="ghost-btn" onClick={logout}>
                Logout
              </button>
            </div>

            {role === "citizen" ? (
              <CitizenWorkspace
                token={token}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            ) : null}

            {role === "admin" ? (
              <AdminWorkspace
                token={token}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            ) : null}

            {role === "staff" ? (
              <StaffWorkspace
                token={token}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            ) : null}

            {!role || !["citizen", "admin", "staff"].includes(role) ? (
              <p className="info-box">Unknown role: {String(role || "none")}</p>
            ) : (
              <></>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function AuthCard({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [cid, setCid] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const submitLabel = mode === "login" ? "Login" : "Register";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "register") {
        await apiRequest({
          path: "/auth/register",
          method: "POST",
          body: { cid, fullName, email, password },
        });
        setMode("login");
        setMessage("Registered. Verify email from backend log, then login.");
      } else {
        const result = await apiRequest({
          path: "/auth/login",
          method: "POST",
          body: { cid, password },
        });
        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        onAuthenticated({ nextToken: result.token, nextUser: result.user });
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-card">
      <div className="mode-switch">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
          type="button"
        >
          Login
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => setMode("register")}
          type="button"
        >
          Register
        </button>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label>
            Full Name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
        ) : null}

        <label>
          CID
          <input value={cid} onChange={(e) => setCid(e.target.value)} required />
        </label>

        {mode === "register" ? (
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </label>
        ) : null}

        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>

        <button className="solid-btn" disabled={loading}>
          {loading ? "Please wait..." : submitLabel}
        </button>
      </form>

      {message ? <p className="feedback">{message}</p> : null}
    </section>
  );
}

function CitizenWorkspace({ token, activeTab, onTabChange }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="workspace">
      <div className="tab-row">
        <button
          className={activeTab === "report" ? "active" : ""}
          onClick={() => onTabChange("report")}
          type="button"
        >
          Report Issue
        </button>
        <button
          className={activeTab === "reports" ? "active" : ""}
          onClick={() => onTabChange("reports")}
          type="button"
        >
          My Reports
        </button>
      </div>

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
            <a href={item.photo_url} target="_blank" rel="noreferrer" className="photo-link">
              View Photo
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function AdminWorkspace({ token, activeTab, onTabChange }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="workspace">
      <div className="tab-row">
        <button
          className={activeTab === "admin-issues" ? "active" : ""}
          onClick={() => onTabChange("admin-issues")}
          type="button"
        >
          All Issues
        </button>
        <button
          className={activeTab === "admin-assign" ? "active" : ""}
          onClick={() => onTabChange("admin-assign")}
          type="button"
        >
          Assign Department
        </button>
      </div>

      {activeTab === "admin-assign" ? (
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

function StaffWorkspace({ token, activeTab, onTabChange }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="workspace">
      <div className="tab-row">
        <button
          className={activeTab === "staff-issues" ? "active" : ""}
          onClick={() => onTabChange("staff-issues")}
          type="button"
        >
          Assigned Issues
        </button>
        <button
          className={activeTab === "staff-update" ? "active" : ""}
          onClick={() => onTabChange("staff-update")}
          type="button"
        >
          Update Status
        </button>
      </div>

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
        </article>
      ))}
    </div>
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

export default App;
