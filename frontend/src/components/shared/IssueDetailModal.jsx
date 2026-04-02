import { useEffect, useState } from "react";
import { apiRequest } from "../../api.js";

function IssueDetailModal({ issueId, token, onClose }) {
  const [issueDetails, setIssueDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadDetails = async () => {
      if (!issueId) return;
      setDetailsLoading(true);
      setDetailsError("");
      try {
        const result = await apiRequest({ path: `/issues/${issueId}`, token });
        if (mounted) {
          setIssueDetails(result);
        }
      } catch (fetchError) {
        if (mounted) {
          setDetailsError(fetchError.message);
          setIssueDetails(null);
        }
      } finally {
        if (mounted) {
          setDetailsLoading(false);
        }
      }
    };

    loadDetails();
    return () => {
      mounted = false;
    };
  }, [issueId, token]);

  if (!issueId) return null;

  return (
    <section className="issue-modal-overlay" onClick={onClose} role="presentation">
      <article
        className="issue-modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Issue details"
      >
        <div className="issue-modal-head">
          <h4>Issue Details #{issueId}</h4>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>

        {detailsLoading ? <p className="info-box">Loading details...</p> : null}
        {detailsError ? <p className="info-box">{detailsError}</p> : null}

        {!detailsLoading && !detailsError && issueDetails?.issue ? (
          <>
            <div className="meta-row">
              <span>Status: {issueDetails.issue.status}</span>
              <span>Department: {issueDetails.issue.assigned_department_name || "Unassigned"}</span>
            </div>

            <div className="meta-row">
              <span>Creator: {issueDetails.issue.created_by_name || "N/A"}</span>
              <span>
                Estimated Cost: {issueDetails.issue.estimated_cost != null
                  ? `$${Number(issueDetails.issue.estimated_cost).toFixed(2)}`
                  : "-"}
              </span>
            </div>

            <div className="meta-row">
              <span>
                Final Cost: {issueDetails.issue.final_cost != null
                  ? `$${Number(issueDetails.issue.final_cost).toFixed(2)}`
                  : "-"}
              </span>
            </div>

            <p className="issue-detail-text">
              {issueDetails.issue.description || "No description provided."}
            </p>

            <div className="issue-detail-block">
              <h5>Citizen Uploaded Photo</h5>
              {issueDetails.issue.photo_url ? (
                <a
                  href={issueDetails.issue.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="photo-link"
                >
                  <img
                    src={issueDetails.issue.photo_url}
                    alt={`Citizen upload for issue ${issueId}`}
                    className="issue-photo"
                    loading="lazy"
                  />
                  Open citizen photo
                </a>
              ) : (
                <p className="info-box">No citizen photo uploaded.</p>
              )}
            </div>

            <div className="issue-detail-block">
              <h5>Department Progress Updates ({issueDetails.updates?.length || 0})</h5>
              {issueDetails.updates?.length ? (
                <ul className="issue-updates-list">
                  {issueDetails.updates.map((update) => (
                    <li key={update.id} className="issue-update-item">
                      <div className="meta-row">
                        <span>
                          By: {update.created_by_name || update.created_by_cid || `User ${update.created_by}`}
                        </span>
                        <span>{new Date(update.created_at).toLocaleString()}</span>
                      </div>
                      <p className="issue-detail-text">{update.message}</p>
                      {update.cost_added != null ? (
                        <p className="issue-cost-pill">Cost Added: ${Number(update.cost_added).toFixed(2)}</p>
                      ) : null}
                      {update.photo_url ? (
                        <a href={update.photo_url} target="_blank" rel="noreferrer" className="photo-link">
                          <img
                            src={update.photo_url}
                            alt={`Progress update ${update.id}`}
                            className="issue-photo"
                            loading="lazy"
                          />
                          Open staff photo
                        </a>
                      ) : (
                        <p className="info-box">No photo for this update.</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="info-box">No updates yet.</p>
              )}
            </div>
          </>
        ) : null}
      </article>
    </section>
  );
}

export default IssueDetailModal;