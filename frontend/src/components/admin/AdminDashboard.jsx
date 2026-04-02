import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest } from "../../api.js";
import {
  CATEGORY_LABELS,
  STATUS_CHART_COLORS,
  STATUS_LABELS,
  TREND_CHART_COLOR,
  TYPE_CHART_COLORS,
} from "../../constants";

function AdminDashboard({ token }) {
  const [issues, setIssues] = useState([]);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadIssues = async () => {
      setLoading(true);
      setFeedback("");
      try {
        const [result, summaryResult] = await Promise.all([
          apiRequest({ path: "/issues", token }),
          apiRequest({ path: "/admin/financial-summary", token }),
        ]);
        if (mounted) {
          setIssues(result.issues || []);
          setFinancialSummary(summaryResult || null);
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

    loadIssues();
    return () => {
      mounted = false;
    };
  }, [token]);

  const statusData = useMemo(() => {
    const counts = issues.reduce((acc, issue) => {
      const key = issue.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([key, value]) => ({
      key,
      name: STATUS_LABELS[key] || key,
      value,
    }));
  }, [issues]);

  const typeData = useMemo(() => {
    const counts = issues.reduce((acc, issue) => {
      const key = issue.category || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([key, value]) => ({
        key,
        name: CATEGORY_LABELS[key] || key,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [issues]);

  const issuesByDay = useMemo(() => {
    const toLocalDayKey = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const counts = issues.reduce((acc, issue) => {
      const date = new Date(issue.created_at);
      if (Number.isNaN(date.getTime())) return acc;
      const dayKey = toLocalDayKey(date);
      acc[dayKey] = (acc[dayKey] || 0) + 1;
      return acc;
    }, {});

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const dayKey = toLocalDayKey(date);
      return {
        day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: counts[dayKey] || 0,
      };
    });
  }, [issues]);

  const totals = useMemo(() => {
    const pending = issues.filter((issue) => issue.status === "pending").length;
    const inProgress = issues.filter((issue) => issue.status === "in_progress").length;
    const resolved = issues.filter((issue) => issue.status === "resolved").length;
    const resolutionRate = issues.length ? Math.round((resolved / issues.length) * 100) : 0;

    return {
      total: issues.length,
      pending,
      inProgress,
      resolved,
      resolutionRate,
      types: typeData.length,
    };
  }, [issues, typeData.length]);

  const recentIssues = useMemo(
    () =>
      [...issues]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 12),
    [issues],
  );

  const statusTargetTag = totals.pending > totals.resolved ? "Needs Focus" : "On Track";
  const statusTargetText = totals.pending > totals.resolved
    ? "Pending queue is above resolved volume"
    : "Resolved volume is keeping pace";

  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    [],
  );

  const budgetVsActualData = useMemo(() => {
    return (financialSummary?.budgetVsActual || []).map((item) => ({
      name: item.department_name,
      budget: Number(item.budget_total || 0),
      actual: Number(item.budget_used || 0),
    }));
  }, [financialSummary]);

  const categoryCostData = useMemo(() => {
    return (financialSummary?.categoryCosts || []).slice(0, 6).map((item) => ({
      name: CATEGORY_LABELS[item.category] || item.category || "Unknown",
      total: Number(item.total_final_cost || 0),
      avg: Number(item.avg_final_cost || 0),
    }));
  }, [financialSummary]);

  const efficiencyData = useMemo(() => {
    return (financialSummary?.efficiency || []).slice(0, 12).map((item) => ({
      id: `#${item.id}`,
      hours: Number(item.resolution_hours || 0),
      cost: Number(item.final_cost || 0),
    }));
  }, [financialSummary]);

  const overallFinance = financialSummary?.overall || {};
  const overBudgetCount = (financialSummary?.overBudget || []).length;

  return (
    <section className="admin-dashboard-v2">
      <header className="admin-dashboard-v2__head">
        <h2>City Manager&apos;s Dashboard</h2>
        <p>Operational overview of requests, status velocity, and department workload</p>
      </header>

      {loading ? <p className="info-box">Loading issue analytics...</p> : null}
      {feedback ? <p className="feedback">{feedback}</p> : null}
      {!loading && !feedback && !issues.length ? <p className="info-box">No issues available yet.</p> : null}

      {!loading && !feedback && issues.length ? (
        <section className="admin-tile-grid">
          <article className="admin-tile admin-tile--kpi">
            <div className="admin-tile__head">
              <h3>Total Service Requests</h3>
              <span className="admin-chip">Updated Live</span>
            </div>
            <p className="admin-tile__big">{totals.total}</p>
            <p className="admin-tile__meta">Across {totals.types} issue categories</p>
          </article>

          <article className="admin-tile">
            <div className="admin-tile__head">
              <h3>Status Breakdown</h3>
              <span className={`admin-chip ${statusTargetTag === "Needs Focus" ? "admin-chip--warn" : "admin-chip--ok"}`}>
                {statusTargetTag}
              </span>
            </div>
            <p className="admin-tile__sub">{statusTargetText}</p>
            <div className="admin-tile__chart">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={74}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={entry.key} fill={STATUS_CHART_COLORS[index % STATUS_CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {overBudgetCount ? (
              <p className="admin-overbudget-alert">
                Over-budget: {(financialSummary?.overBudget || []).map((item) => item.department_name).join(", ")}
              </p>
            ) : null}
          </article>

          <article className="admin-tile">
            <div className="admin-tile__head">
              <h3>Issue Type Mix</h3>
              <span className="admin-chip">Top Categories</span>
            </div>
            <p className="admin-tile__sub">Distribution by issue type</p>
            <div className="admin-tile__chart">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={typeData.slice(0, 6)} margin={{ top: 4, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe7f4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-16} textAnchor="end" height={42} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                    {typeData.slice(0, 6).map((entry, index) => (
                      <Cell key={entry.key} fill={TYPE_CHART_COLORS[index % TYPE_CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="admin-tile">
            <div className="admin-tile__head">
              <h3>7-Day Submission Trend</h3>
              <span className="admin-chip">Weekly</span>
            </div>
            <p className="admin-tile__sub">Incoming requests by day</p>
            <div className="admin-tile__chart">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={issuesByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe7f4" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={TREND_CHART_COLOR} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="admin-tile admin-tile--metrics">
            <div className="admin-tile__head">
              <h3>Execution Snapshot</h3>
              <span className="admin-chip">Live Counters</span>
            </div>
            <div className="admin-metric-list">
              <div>
                <span>Resolution Rate</span>
                <strong>{totals.resolutionRate}%</strong>
              </div>
              <div>
                <span>Pending</span>
                <strong>{totals.pending}</strong>
              </div>
              <div>
                <span>In Progress</span>
                <strong>{totals.inProgress}</strong>
              </div>
              <div>
                <span>Resolved</span>
                <strong>{totals.resolved}</strong>
              </div>
              <div>
                <span>Avg Cost / Incident</span>
                <strong>{currency.format(Number(overallFinance.avg_cost_per_issue || 0))}</strong>
              </div>
              <div>
                <span>Total Cost</span>
                <strong>{currency.format(Number(overallFinance.total_final_cost || 0))}</strong>
              </div>
              <div>
                <span>Over-budget Departments</span>
                <strong>{overBudgetCount}</strong>
              </div>
            </div>
          </article>

          <article className="admin-tile">
            <div className="admin-tile__head">
              <h3>Budget vs Actual by Department</h3>
              <span className={`admin-chip ${overBudgetCount ? "admin-chip--warn" : "admin-chip--ok"}`}>
                {overBudgetCount ? "Over Budget" : "Healthy"}
              </span>
            </div>
            <p className="admin-tile__sub">Allocated vs consumed budget</p>
            <div className="admin-tile__chart">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={budgetVsActualData} margin={{ top: 4, right: 8, left: 8, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe7f4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-16} textAnchor="end" height={46} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => currency.format(Number(value || 0))} />
                  <Legend />
                  <Bar dataKey="budget" fill="#64748b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="#0b5cab" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="admin-tile">
            <div className="admin-tile__head">
              <h3>Cost per Category</h3>
              <span className="admin-chip">Financial Mix</span>
            </div>
            <p className="admin-tile__sub">Total closure cost by category</p>
            <div className="admin-tile__chart">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryCostData} margin={{ top: 4, right: 8, left: 8, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe7f4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-16} textAnchor="end" height={46} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => currency.format(Number(value || 0))} />
                  <Bar dataKey="total" fill="#b45309" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="admin-tile">
            <div className="admin-tile__head">
              <h3>Cost vs Resolution Time</h3>
              <span className="admin-chip">Efficiency</span>
            </div>
            <p className="admin-tile__sub">Higher bars indicate expensive or slower closures</p>
            <div className="admin-tile__chart">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={efficiencyData} margin={{ top: 4, right: 8, left: 8, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe7f4" />
                  <XAxis dataKey="id" tick={{ fontSize: 10 }} interval={0} angle={-16} textAnchor="end" height={44} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value, name) => (name === "cost" ? currency.format(Number(value || 0)) : `${value}h`)} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="hours" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="cost" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="admin-tile admin-tile--table">
            <div className="admin-tile__head">
              <h3>Latest Issues</h3>
              <span className="admin-chip">Recent 12</span>
            </div>
            {!recentIssues.length ? (
              <p className="info-box">No issues yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Issue</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Department</th>
                      <th>Budget</th>
                      <th>Estimated</th>
                      <th>Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentIssues.map((issue) => (
                      <tr key={issue.id}>
                        <td>{new Date(issue.created_at).toLocaleString()}</td>
                        <td>
                          #{issue.id} {issue.title}
                        </td>
                        <td>{CATEGORY_LABELS[issue.category] || issue.category || "-"}</td>
                        <td>{STATUS_LABELS[issue.status] || issue.status || "-"}</td>
                        <td>{issue.assigned_department_name || "Unassigned"}</td>
                        <td>{issue.budget_id ? `#${issue.budget_id}` : "-"}</td>
                        <td>
                          {issue.estimated_cost != null
                            ? currency.format(Number(issue.estimated_cost || 0))
                            : "-"}
                        </td>
                        <td>
                          {issue.final_cost != null
                            ? currency.format(Number(issue.final_cost || 0))
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      ) : null}
    </section>
  );
}

export default AdminDashboard;

