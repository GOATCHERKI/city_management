import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../api.js";

function AssignIssueForm({ token, onAssigned }) {
  const [issueId, setIssueId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [departments, setDepartments] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [users, setUsers] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [budgetFeedback, setBudgetFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [newDepartment, setNewDepartment] = useState({
    name: "",
    description: "",
  });
  const [deptUpdate, setDeptUpdate] = useState({ userId: "", departmentId: "" });
  const [newBudget, setNewBudget] = useState({
    departmentId: "",
    category: "",
    periodMonth: new Date().toISOString().slice(0, 7),
    totalAmount: "",
  });

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [deptResult, userResult, budgetResult] = await Promise.all([
          apiRequest({ path: "/issues/departments", token }),
          apiRequest({ path: "/admin/users", token }),
          apiRequest({ path: "/admin/budgets", token }),
        ]);
        if (mounted) {
          setDepartments(deptResult.departments || []);
          setUsers(userResult.users || []);
          setBudgets(budgetResult.budgets || []);
        }
      } catch (error) {
        if (mounted) setFeedback(error.message);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [token]);

  const refreshDepartmentAndUsers = useCallback(async () => {
    const [deptResult, userResult, budgetResult] = await Promise.all([
      apiRequest({ path: "/issues/departments", token }),
      apiRequest({ path: "/admin/users", token }),
      apiRequest({ path: "/admin/budgets", token }),
    ]);
    setDepartments(deptResult.departments || []);
    setUsers(userResult.users || []);
    setBudgets(budgetResult.budgets || []);
  }, [token]);

  const refreshBudgetsOnly = useCallback(async () => {
    const budgetResult = await apiRequest({ path: "/admin/budgets", token });
    setBudgets(budgetResult.budgets || []);
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
        body: {
          departmentId: Number(departmentId),
          budgetId: budgetId ? Number(budgetId) : undefined,
          estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
        },
      });
      setFeedback("Issue assigned successfully.");
      setIssueId("");
      setDepartmentId("");
      setBudgetId("");
      setEstimatedCost("");
      onAssigned();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitCreateDepartment = async (event) => {
    event.preventDefault();
    setFeedback("");
    try {
      await apiRequest({
        path: "/admin/departments",
        method: "POST",
        token,
        body: {
          name: newDepartment.name,
          description: newDepartment.description,
        },
      });
      setFeedback("Department created successfully.");
      setNewDepartment({
        name: "",
        description: "",
      });
      await refreshDepartmentAndUsers();
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
      setDeptUpdate({ userId: "", departmentId: "" });
      await refreshDepartmentAndUsers();
    } catch (error) {
      setFeedback(error.message);
    }
  };

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
          departmentId: Number(newBudget.departmentId),
          category: newBudget.category || null,
          periodMonth: newBudget.periodMonth,
          totalAmount: Number(newBudget.totalAmount),
        },
      });
      setBudgetFeedback("Budget saved successfully.");
      setNewBudget((prev) => ({ ...prev, category: "", totalAmount: "" }));
      await refreshBudgetsOnly();
    } catch (error) {
      setBudgetFeedback(error.message);
    } finally {
      setBudgetSaving(false);
    }
  };

  const handleRemoveStaffFromDepartment = async (userId) => {
    setActionLoading(`remove-${userId}`);
    setFeedback("");
    try {
      await apiRequest({
        path: `/admin/users/${userId}/department`,
        method: "PATCH",
        token,
        body: { departmentId: null },
      });
      setFeedback("Staff removed from department.");
      await refreshDepartmentAndUsers();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setActionLoading("");
    }
  };

  const handleDeleteDepartment = async (department) => {
    const confirmed = window.confirm(
      `Delete department "${department.name}"? Staff and issue assignments will be unassigned.`,
    );
    if (!confirmed) return;

    setActionLoading(`delete-${department.id}`);
    setFeedback("");
    try {
      await apiRequest({
        path: `/admin/departments/${department.id}`,
        method: "DELETE",
        token,
      });
      setFeedback("Department deleted successfully.");
      await refreshDepartmentAndUsers();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setActionLoading("");
    }
  };

  return (
    <section className="admin-grid">
      <section className="card-box full-width">
        <h3>Funding & Budget Setup</h3>
        <p className="info-box">
          Admin can define monthly department budgets here (for example, government funding allocations),
          then link budgets and estimated costs while assigning incidents.
        </p>
      </section>

      <form className="form-grid card-box full-width" onSubmit={submitAssign}>
        <h3 className="full-width">Assign Issue to Department</h3>
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
            onChange={(event) => {
              setDepartmentId(event.target.value);
              setBudgetId("");
            }}
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

        <label>
          Budget (optional)
          <select value={budgetId} onChange={(event) => setBudgetId(event.target.value)}>
            <option value="">No budget</option>
            {budgets
              .filter((item) => !departmentId || Number(item.department_id) === Number(departmentId))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.department_name} / {item.period_month?.slice(0, 7)} / {item.category || "All"}
                </option>
              ))}
          </select>
        </label>

        <label>
          Estimated Cost (optional)
          <input
            type="number"
            min="0"
            step="0.01"
            value={estimatedCost}
            onChange={(event) => setEstimatedCost(event.target.value)}
            required={Boolean(budgetId)}
            placeholder="e.g. 120.00"
          />
        </label>

        <button className="solid-btn" disabled={loading}>
          {loading ? "Assigning..." : "Assign Issue"}
        </button>

        {feedback ? <p className="feedback">{feedback}</p> : null}
      </form>

      <form className="form-grid card-box full-width" onSubmit={submitCreateDepartment}>
        <h3 className="full-width">Create Department</h3>
        <label className="full-width">
          Department Name
          <input
            value={newDepartment.name}
            onChange={(e) => setNewDepartment((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
        </label>
        <label className="full-width">
          Description (optional)
          <textarea
            value={newDepartment.description}
            onChange={(e) => setNewDepartment((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            placeholder="e.g., Sanitation Services, Water Management, etc."
          />
        </label>
        <button className="solid-btn">Create Department</button>
      </form>

      <form className="form-grid card-box full-width" onSubmit={submitDepartmentUpdate}>
        <h3 className="full-width">Assign Staff to Department</h3>
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
                  #{user.id} {user.cid} ({user.full_name})
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
        <button className="solid-btn">Assign Staff</button>
      </form>

      <form className="form-grid card-box full-width" onSubmit={submitCreateBudget}>
        <h3 className="full-width">Create / Update Department Budget</h3>
        <label>
          Department
          <select
            value={newBudget.departmentId}
            onChange={(e) => setNewBudget((prev) => ({ ...prev, departmentId: e.target.value }))}
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
        <label>
          Category (optional)
          <input
            value={newBudget.category}
            onChange={(e) => setNewBudget((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="e.g. pothole"
          />
        </label>
        <label>
          Period (month)
          <input
            type="month"
            value={newBudget.periodMonth}
            onChange={(e) => setNewBudget((prev) => ({ ...prev, periodMonth: e.target.value }))}
            required
          />
        </label>
        <label>
          Budget Amount
          <input
            type="number"
            min="0"
            step="0.01"
            value={newBudget.totalAmount}
            onChange={(e) => setNewBudget((prev) => ({ ...prev, totalAmount: e.target.value }))}
            placeholder="e.g. 50000"
            required
          />
        </label>
        <button className="solid-btn" disabled={budgetSaving}>
          {budgetSaving ? "Saving..." : "Save Budget"}
        </button>

        {budgetFeedback ? <p className="feedback full-width">{budgetFeedback}</p> : null}
      </form>

      <section className="card-box full-width">
        <h3>Budget Registry</h3>
        {budgets.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Category</th>
                  <th>Period</th>
                  <th>Total</th>
                  <th>Used</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((item) => (
                  <tr key={item.id}>
                    <td>{item.department_name}</td>
                    <td>{item.category || "All"}</td>
                    <td>{item.period_month?.slice(0, 7)}</td>
                    <td>${Number(item.total_amount || 0).toFixed(2)}</td>
                    <td>${Number(item.used_amount || 0).toFixed(2)}</td>
                    <td>${Number(item.remaining_amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="info-box">No budgets configured yet.</p>
        )}
      </section>

      <section className="card-box full-width">
        <h3>Departments & Staff</h3>
        {loading ? (
          <p className="info-box">Loading departments...</p>
        ) : departments.length ? (
          <div className="departments-list">
            {departments.map((dept) => {
              const staffInDept = users.filter(
                (user) => user.role === "staff" && user.department_id === dept.id,
              );
              return (
                <article key={dept.id} className="department-item">
                  <div className="department-header">
                    <h4>{dept.name}</h4>
                    <span className="staff-count">({staffInDept.length} staff)</span>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => handleDeleteDepartment(dept)}
                      disabled={actionLoading === `delete-${dept.id}`}
                    >
                      {actionLoading === `delete-${dept.id}` ? "Deleting..." : "Delete Department"}
                    </button>
                  </div>
                  {dept.description && <p className="department-desc">{dept.description}</p>}
                  {staffInDept.length > 0 ? (
                    <ul className="staff-list">
                      {staffInDept.map((staff) => (
                        <li key={staff.id}>
                          <div>
                            <strong>{staff.full_name}</strong> - CID: {staff.cid}
                          </div>
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={() => handleRemoveStaffFromDepartment(staff.id)}
                            disabled={actionLoading === `remove-${staff.id}`}
                          >
                            {actionLoading === `remove-${staff.id}`
                              ? "Removing..."
                              : "Remove from Department"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="info-box" style={{ marginTop: "8px" }}>No staff assigned</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="info-box">No departments available.</p>
        )}
      </section>
    </section>
  );
}

export default AssignIssueForm;
