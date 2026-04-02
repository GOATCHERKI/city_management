import { useEffect, useState } from "react";
import { apiRequest } from "../../api.js";

function DeptAdminStaff({ token, departmentId }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setFeedback("");
      try {
        const result = await apiRequest({ path: "/admin/users", token });
        if (mounted) {
          const deptStaff = (result.users || []).filter(
            (u) =>
              Number(u.department_id) === Number(departmentId) &&
              (u.role === "staff" || u.role === "dept_admin"),
          );
          setStaff(deptStaff);
        }
      } catch (error) {
        if (mounted) setFeedback(error.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
  }, [departmentId, token]);

  if (loading) return <p className="info-box">Loading staff...</p>;

  return (
    <section className="card-box">
      <h3>Department Staff</h3>
      <p className="hint">Staff members assigned to your department.</p>

      {feedback ? <p className="feedback">{feedback}</p> : null}

      {!staff.length ? (
        <p className="info-box">No staff assigned to your department.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>CID</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name}</td>
                  <td>{user.cid}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`status status-${user.role === "staff" ? "progress" : "pending"}`}>
                      {user.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default DeptAdminStaff;