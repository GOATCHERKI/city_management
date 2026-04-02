import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import * as XLSX from "xlsx";
import { apiRequest } from "../../api.js";
import {
  ISSUES_PAGE_SIZE,
  ISTANBUL_CENTER,
  STATUS_CLASS,
  issueMarkerIcon,
} from "../../constants";
import IssueDetailModal from "../../components/shared/IssueDetailModal";

function AllIssues({ token, refreshKey }) {
  const [issues, setIssues] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [exportScope, setExportScope] = useState("all");
  const [exportDepartmentId, setExportDepartmentId] = useState("");
  const [exportIssueId, setExportIssueId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(issues.length / ISSUES_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * ISSUES_PAGE_SIZE;
  const pageEndIndex = pageStartIndex + ISSUES_PAGE_SIZE;

  const pagedIssues = useMemo(
    () => issues.slice(pageStartIndex, pageEndIndex),
    [issues, pageEndIndex, pageStartIndex],
  );

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
        const [issuesResult, departmentsResult] = await Promise.all([
          apiRequest({ path: "/issues", token }),
          apiRequest({ path: "/issues/departments", token }),
        ]);
        if (mounted) {
          setIssues(issuesResult.issues || []);
          setDepartments(departmentsResult.departments || []);
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

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openIssueDetails = async (issueId) => {
    if (selectedIssueId === issueId) {
      setSelectedIssueId(null);
      return;
    }
    setSelectedIssueId(issueId);
  };

  const closeIssueDetails = () => {
    setSelectedIssueId(null);
  };

  const exportIssuesToExcel = async () => {
    setExporting(true);
    setExportFeedback("");

    try {
      let issueList = [];

      if (exportScope === "single") {
        const chosenIssueId = Number(exportIssueId);
        if (!Number.isInteger(chosenIssueId) || chosenIssueId <= 0) {
          throw new Error("Choose a valid issue for single issue export.");
        }
        issueList = [{ id: chosenIssueId }];
      } else if (exportScope === "department") {
        const chosenDepartmentId = Number(exportDepartmentId);
        if (!Number.isInteger(chosenDepartmentId) || chosenDepartmentId <= 0) {
          throw new Error("Choose a department to export department issues.");
        }
        const result = await apiRequest({ path: `/issues?department=${chosenDepartmentId}`, token });
        issueList = result.issues || [];
      } else {
        const result = await apiRequest({ path: "/issues", token });
        issueList = result.issues || [];
      }

      if (!issueList.length) {
        throw new Error("No issues found for this export filter.");
      }

      let budgetMap = new Map();
      try {
        const budgetResult = await apiRequest({ path: "/admin/budgets", token });
        budgetMap = new Map((budgetResult.budgets || []).map((budget) => [Number(budget.id), budget]));
      } catch {
        budgetMap = new Map();
      }

      const detailsPayload = await Promise.all(
        issueList.map((item) => apiRequest({ path: `/issues/${item.id}`, token })),
      );

      const rows = detailsPayload.map((payload) => {
        const issue = payload.issue || {};
        const updates = payload.updates || [];
        const budget = budgetMap.get(Number(issue.budget_id));
        const budgetTotal = budget ? Number(budget.total_amount || 0) : null;
        const budgetUsed = budget ? Number(budget.used_amount || 0) : null;
        const budgetRemaining = budget ? budgetTotal - budgetUsed : null;
        const updatesSummary = updates
          .map((update) => {
            const at = update.created_at ? new Date(update.created_at).toLocaleString() : "-";
            const by = update.created_by_name || update.created_by_cid || `User ${update.created_by || "-"}`;
            const cost =
              update.cost_added != null ? `$${Number(update.cost_added).toFixed(2)}` : "$0.00";
            return `[${at}] ${by} | ${update.message || "-"} | Cost ${cost}`;
          })
          .join("\n");

        return {
          IssueID: issue.id ?? "",
          Title: issue.title ?? "",
          Description: issue.description ?? "",
          Category: issue.category ?? "",
          Status: issue.status ?? "",
          Department: issue.assigned_department_name || "Unassigned",
          CreatedBy: issue.created_by_name || issue.created_by_cid || issue.created_by || "",
          Latitude: issue.latitude ?? "",
          Longitude: issue.longitude ?? "",
          EstimatedCost: issue.estimated_cost != null ? Number(issue.estimated_cost) : "",
          FinalCost: issue.final_cost != null ? Number(issue.final_cost) : "",
          BudgetID: issue.budget_id ?? "",
          BudgetCategory: budget?.category || "",
          BudgetPeriodMonth: budget?.period_month || "",
          BudgetTotalAmount: budgetTotal != null ? budgetTotal : "",
          BudgetUsedAmount: budgetUsed != null ? budgetUsed : "",
          BudgetRemainingAmount: budgetRemaining != null ? budgetRemaining : "",
          IssueCreatedAt: issue.created_at ? new Date(issue.created_at).toLocaleString() : "",
          IssueUpdatedAt: issue.updated_at ? new Date(issue.updated_at).toLocaleString() : "",
          IssueResolvedAt: issue.resolved_at ? new Date(issue.resolved_at).toLocaleString() : "",
          CitizenPhotoURL: issue.photo_url || "",
          UpdateCount: updates.length,
          UpdatesDetails: updatesSummary,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Issues");

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const scopeLabel = exportScope === "single" ? "single" : exportScope === "department" ? "department" : "all";
      XLSX.writeFile(workbook, `issues-export-${scopeLabel}-${timestamp}.xlsx`);

      setExportFeedback(`Export completed. ${rows.length} issue(s) downloaded.`);
    } catch (exportError) {
      setExportFeedback(exportError.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

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

      <section className="issues-export-panel" aria-label="Issue export filters">
        <div className="issues-export-panel__head">
          <h3>Export Issues to Excel</h3>
          <p>Choose what to export: all issues, one department, or a single issue.</p>
        </div>

        <div className="issues-export-panel__grid">
          <label>
            Export Scope
            <select value={exportScope} onChange={(event) => setExportScope(event.target.value)}>
              <option value="all">All Issues</option>
              <option value="department">Department Issues</option>
              <option value="single">Single Issue</option>
            </select>
          </label>

          {exportScope === "department" ? (
            <label>
              Department
              <select
                value={exportDepartmentId}
                onChange={(event) => setExportDepartmentId(event.target.value)}
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {exportScope === "single" ? (
            <label>
              Issue
              <select value={exportIssueId} onChange={(event) => setExportIssueId(event.target.value)}>
                <option value="">Select issue</option>
                {issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    #{issue.id} {issue.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button type="button" className="solid-btn" onClick={exportIssuesToExcel} disabled={exporting}>
            {exporting ? "Exporting..." : "Export Excel"}
          </button>
        </div>

        {exportFeedback ? <p className="feedback">{exportFeedback}</p> : null}
      </section>

      <div className="report-list">
        {pagedIssues.map((item) => (
          <article
            className="report-card report-card--clickable"
            key={item.id}
            onClick={() => openIssueDetails(item.id)}
          >
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

      <div className="issues-pagination" aria-label="Issue list pagination">
        <span>
          Showing {issues.length ? pageStartIndex + 1 : 0}-{Math.min(pageEndIndex, issues.length)} of {issues.length}
        </span>
        <div className="issues-pagination__actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
          >
            Previous
          </button>
          <span>
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {selectedIssueId ? (
        <IssueDetailModal issueId={selectedIssueId} token={token} onClose={closeIssueDetails} />
      ) : null}
    </section>
  );
}

export default AllIssues;