import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";

function DeptAdminBudgets({ token, departmentId, onBudgetUpdated }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [budgetFeedback, setBudgetFeedback] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [newBudget, setNewBudget] = useState({
    category: "",
    periodMonth: new Date().toISOString().slice(0, 7),
    totalAmount: "",
  });

  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }),
    [],
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setFeedback("");
      try {
        const result = await apiRequest({ path: "/admin/budgets", token });
        if (mounted) {
          const deptBudgets = (result.budgets || []).filter(
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

  const submitCreateBudget = async (event) => {
    event.preventDefault();
    setBudgetSaving(true);
    setBudgetFeedback("");
    try {
      await apiRequest({
        path: "/admin/budgets",
        method: "POST",
        token,
        body: {
          departmentId: Number(departmentId),
          category: newBudget.category || null,
          periodMonth: newBudget.periodMonth,
          totalAmount: Number(newBudget.totalAmount),
        },
      });
      setBudgetFeedback("Budget saved successfully.");
      setNewBudget({
        category: "",
        periodMonth: new Date().toISOString().slice(0, 7),
        totalAmount: "",
      });
      onBudgetUpdated();
      const result = await apiRequest({ path: "/admin/budgets", token });
      const deptBudgets = (result.budgets || []).filter(
        (b) => Number(b.department_id) === Number(departmentId),
      );
      setBudgets(deptBudgets);
    } catch (error) {
      setBudgetFeedback(error.message);
    } finally {
      setBudgetSaving(false);
    }
  };

  if (loading) return <p className="info-box">Loading budgets...</p>;

  return (
    <section className="form-and-list">
      <article className="card-box">
        <h3>Create/Update Budget</h3>
        <p className="hint">
          Create or update a budget for your department (per category, per month).
        </p>

        <form className="form-grid" onSubmit={submitCreateBudget}>
          <label>
            Category (optional)
            <input
              type="text"
              value={newBudget.category}
              onChange={(event) =>
                setNewBudget((prev) => ({
                  ...prev,
                  category: event.target.value,
                }))
              }
              placeholder="e.g., water_leak, pothole"
            />
          </label>

          <label>
            Period (Month)
            <input
              type="month"
              value={newBudget.periodMonth}
              onChange={(event) =>
                setNewBudget((prev) => ({
                  ...prev,
                  periodMonth: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Total Amount ($)
            <input
              type="number"
              step="0.01"
              min="0"
              value={newBudget.totalAmount}
              onChange={(event) =>
                setNewBudget((prev) => ({
                  ...prev,
                  totalAmount: event.target.value,
                }))
              }
              required
            />
          </label>

          <button
            className="solid-btn"
            disabled={budgetSaving}
            style={{
              padding: "0.55rem 0.95rem",
              fontSize: "0.95rem",
              width: "fit-content",
              justifySelf: "start",
              alignSelf: "end",
            }}
          >
            {budgetSaving ? "Saving..." : "Save Budget"}
          </button>
        </form>

        {budgetFeedback ? <p className="feedback">{budgetFeedback}</p> : null}
      </article>

      <article className="card-box">
        <h3>Department Budgets</h3>
        {feedback ? <p className="feedback">{feedback}</p> : null}

        {!budgets.length ? (
          <p className="info-box">No budgets yet for your department.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Period</th>
                  <th>Total</th>
                  <th>Used</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget) => {
                  const total = Number(budget.total_amount || 0);
                  const used = Number(budget.used_amount || 0);
                  const remaining = total - used;
                  return (
                    <tr key={budget.id}>
                      <td>{budget.category || "(All)"}</td>
                      <td>
                        {new Date(budget.period_month || Date.now()).toLocaleDateString(
                          undefined,
                          { year: "numeric", month: "short" },
                        )}
                      </td>
                      <td>{currency.format(total)}</td>
                      <td>{currency.format(used)}</td>
                      <td
                        style={{
                          color: remaining < 0 ? "#dc2626" : "#16a34a",
                          fontWeight: "700",
                        }}
                      >
                        {currency.format(remaining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

export default DeptAdminBudgets;