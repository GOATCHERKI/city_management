import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../api.js";

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
          departmentId: (newUser.role === "staff" || newUser.role === "dept_admin") ? Number(newUser.departmentId) : null,
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
          departmentId: (roleUpdate.role === "staff" || roleUpdate.role === "dept_admin") ? Number(roleUpdate.departmentId) : null,
        },
      });
      setFeedback("User role updated.");
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
            onChange={(e) => {
              const newRole = e.target.value;
              setNewUser((prev) => ({
                ...prev,
                role: newRole,
                departmentId: (newRole === "staff" || newRole === "dept_admin") ? prev.departmentId : "",
              }));
            }}
          >
            <option value="citizen">Citizen</option>
            <option value="staff">Staff</option>
            <option value="dept_admin">Department Admin</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {(newUser.role === "staff" || newUser.role === "dept_admin") ? (
          <label>
            Department
            <select
              value={newUser.departmentId}
              onChange={(e) => setNewUser((prev) => ({ ...prev, departmentId: e.target.value }))}
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
        ) : null}
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
            onChange={(e) => {
              const newRole = e.target.value;
              setRoleUpdate((prev) => ({
                ...prev,
                role: newRole,
                departmentId: (newRole === "staff" || newRole === "dept_admin") ? prev.departmentId : "",
              }));
            }}
          >
            <option value="citizen">Citizen</option>
            <option value="staff">Staff</option>
            <option value="dept_admin">Department Admin</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {(roleUpdate.role === "staff" || roleUpdate.role === "dept_admin") ? (
          <label>
            Department
            <select
              value={roleUpdate.departmentId}
              onChange={(e) => setRoleUpdate((prev) => ({ ...prev, departmentId: e.target.value }))}
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
        ) : null}
        <button className="solid-btn user-role-update-btn">Update Role</button>
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

export default AdminUserManagement;