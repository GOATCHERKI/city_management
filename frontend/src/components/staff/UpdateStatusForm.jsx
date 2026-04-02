import { useState } from "react";
import { apiRequest } from "../../api.js";

function UpdateStatusForm({ token, onUpdated }) {
  const [issueId, setIssueId] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [message, setMessage] = useState("");
  const [costAdded, setCostAdded] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const submitUpdate = async (event) => {
    event.preventDefault();
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
        path: `/issues/${issueId}/status`,
        method: "PATCH",
        token,
        body: {
          status,
          message: message || undefined,
          cost_added: costAdded ? Number(costAdded) : undefined,
          photo_url: photoUrl || undefined,
        },
      });
      setFeedback("Issue status updated.");
      setIssueId("");
      setMessage("");
      setCostAdded("");
      setFile(null);
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

      <label>
        Cost Added (optional)
        <input
          type="number"
          min="0"
          step="0.01"
          value={costAdded}
          onChange={(event) => setCostAdded(event.target.value)}
          placeholder="e.g. 80.50"
        />
      </label>

      <label className="full-width">
        Progress Photo (optional)
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
      </label>

      <button className="solid-btn" disabled={loading}>
        {loading ? "Updating..." : "Update Status"}
      </button>

      {feedback ? <p className="feedback">{feedback}</p> : null}
    </form>
  );
}

export default UpdateStatusForm;