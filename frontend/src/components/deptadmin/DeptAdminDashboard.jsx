import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";
import { CATEGORY_LABELS, STATUS_LABELS } from "../../constants";

function DeptAdminDashboard({ token, departmentId }) {
  const [issues, setIssues] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    [],
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setFeedback("");
      try {
        const [issuesResult, budgetsResult] = await Promise.all([
          apiRequest({ path: `/issues?department=${departmentId}`, token }),
          apiRequest({ path: `/admin/budgets`, token }),
        ]);

        if (mounted) {
          setIssues(issuesResult.issues || []);
          const deptBudgets = (budgetsResult.budgets || []).filter(
            (b) => Number(b.department_id) === Number(departmentId),
          );
          setBudgets(deptBudgets);
        }
      } catch (error) {
        if (mounted) setFeedback(error.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
  }, [departmentId, token]);

  const totals = useMemo(() => {
    const pending = issues.filter((i) => i.status === "pending").length;
    const inProgress = issues.filter((i) => i.status === "in_progress").length;
    const resolved = issues.filter((i) => i.status === "resolved").length;
    const total = issues.length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return { total, pending, inProgress, resolved, resolutionRate };
  }, [issues]);

  const financialMetrics = useMemo(() => {
    const totalEstimated = issues.reduce((sum, issue) => {
      return sum + (Number(issue.estimated_cost) || 0);
    }, 0);

    const totalFinal = issues.reduce((sum, issue) => {
      return sum + (Number(issue.final_cost) || 0);
    }, 0);

    const budgetTotal = budgets.reduce((sum, b) => {
      return sum + (Number(b.total_amount) || 0);
    }, 0);

    const budgetUsed = budgets.reduce(
      (sum, b) => sum + (Number(b.used_amount) || 0),
      0,
    );

    return {
      totalEstimated,
      totalFinal,
      budgetTotal,
      budgetUsed,
      budgetRemaining: budgetTotal - budgetUsed,
    };
  }, [issues, budgets]);

  if (loading) return <p className="info-box">Loading department dashboard...</p>;
  if (feedback) return <p className="info-box">{feedback}</p>;

  return (
    <section className="admin-dashboard-v2">
      <header className="admin-dashboard-v2__head">
        <h2>Department Dashboard</h2>
        <p>Overview of your department&apos;s issues, budget, and workload</p>
      </header>

      <section className="admin-tile-grid">
        <article className="admin-tile admin-tile--kpi">
          <div className="admin-tile__head">
            <h3>Total Issues</h3>
            <span className="admin-chip">Assigned</span>
          </div>
          <p className="admin-tile__big">{totals.total}</p>
          <p className="admin-tile__meta">Your department workload</p>
        </article>

        <article className="admin-tile admin-tile--kpi">
          <div className="admin-tile__head">
            <h3>Resolution Rate</h3>
            <span className="admin-chip">Efficiency</span>
          </div>
          <p className="admin-tile__big">{totals.resolutionRate}%</p>
          <p className="admin-tile__meta">
            {totals.resolved} of {totals.total} resolved
          </p>
        </article>

        <article className="admin-tile admin-tile--kpi">
          <div className="admin-tile__head">
            <h3>Budget Status</h3>
            <span
              className={
                financialMetrics.budgetRemaining < 0
                  ? "admin-chip admin-chip--warn"
                  : "admin-chip admin-chip--ok"
              }
            >
              {financialMetrics.budgetRemaining < 0 ? "Over" : "Healthy"}
            </span>
          </div>
          <p className="admin-tile__big">
            {currency.format(financialMetrics.budgetRemaining)}
          </p>
          <p className="admin-tile__meta">Remaining budget</p>
        </article>

        <article className="admin-tile admin-tile--metrics">
          <div className="admin-tile__head">
            <h3>Status Breakdown</h3>
            <span className="admin-chip">Quick Stats</span>
          </div>
          <div className="admin-metric-list">
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
              <span>Total Issues</span>
              <strong>{totals.total}</strong>
            </div>
          </div>
        </article>

        <article className="admin-tile admin-tile--metrics">
          <div className="admin-tile__head">
            <h3>Financial Summary</h3>
            <span className="admin-chip">Costs</span>
          </div>
          <div className="admin-metric-list">
            <div>
              <span>Total Budget</span>
              <strong>{currency.format(financialMetrics.budgetTotal)}</strong>
            </div>
            <div>
              <span>Budget Used</span>
              <strong>{currency.format(financialMetrics.budgetUsed)}</strong>
            </div>
            <div>
              <span>Est. Total Cost</span>
              <strong>{currency.format(financialMetrics.totalEstimated)}</strong>
            </div>
            <div>
              <span>Actual Total Cost</span>
              <strong>{currency.format(financialMetrics.totalFinal)}</strong>
            </div>
          </div>
        </article>

        <article className="admin-tile admin-tile--table">
          <div className="admin-tile__head">
            <h3>Recent Issues</h3>
            <span className="admin-chip">Latest</span>
          </div>
          {!issues.length ? (
            <p className="info-box">No issues assigned to your department.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Issue</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.slice(0, 8).map((issue) => (
                    <tr key={issue.id}>
                      <td>{new Date(issue.created_at).toLocaleString()}</td>
                      <td>
                        #{issue.id} {issue.title}
                      </td>
                      <td>{CATEGORY_LABELS[issue.category] || issue.category}</td>
                      <td>{STATUS_LABELS[issue.status] || issue.status}</td>
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
    </section>
  );
}

export default DeptAdminDashboard;