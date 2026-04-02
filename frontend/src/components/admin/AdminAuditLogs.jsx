import { Fragment, useCallback, useEffect, useState } from "react";
import { API_BASE_URL, apiRequest } from "../../api.js";

function AdminAuditLogs({ token }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [expandedRowId, setExpandedRowId] = useState(null);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [action, setAction] = useState("");
  const [actorCid, setActorCid] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  const buildAuditParams = useCallback(
    ({
      nextQ = debouncedQ,
      nextAction = action,
      nextActorCid = actorCid,
      nextFrom = from,
      nextTo = to,
      nextLimit = limit,
      nextOffset = offset,
      format,
    } = {}) => {
      const params = new URLSearchParams();
      params.set("limit", String(nextLimit));
      params.set("offset", String(nextOffset));
      if (nextQ.trim()) {
        params.set("q", nextQ.trim());
      }
      if (nextActorCid.trim()) {
        params.set("actorCid", nextActorCid.trim());
      }
      if (nextAction) {
        params.set("action", nextAction);
      }
      if (nextFrom) {
        params.set("from", nextFrom);
      }
      if (nextTo) {
        params.set("to", nextTo);
      }
      if (format) {
        params.set("format", format);
      }
      return params;
    },
    [debouncedQ, action, actorCid, from, to, limit, offset],
  );

  const loadLogs = useCallback(
    async ({
      resetOffset = false,
      nextQ = debouncedQ,
      nextAction = action,
      nextActorCid = actorCid,
      nextFrom = from,
      nextTo = to,
      nextLimit = limit,
      nextOffset = offset,
    } = {}) => {
      const effectiveOffset = resetOffset ? 0 : nextOffset;
      setLoading(true);
      setFeedback("");

      try {
        const params = buildAuditParams({
          nextQ,
          nextAction,
          nextActorCid,
          nextFrom,
          nextTo,
          nextLimit,
          nextOffset: effectiveOffset,
        });

        const result = await apiRequest({
          path: `/admin/audit-logs?${params.toString()}`,
          token,
        });

        setLogs(result.logs || []);
        setTotal(Number(result.total || 0));
        if (resetOffset) {
          setOffset(0);
        }
      } catch (error) {
        setFeedback(error.message);
      } finally {
        setLoading(false);
      }
    },
    [debouncedQ, action, actorCid, from, to, limit, offset, token, buildAuditParams],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQ(q);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [q]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (q === debouncedQ) {
      return;
    }

    loadLogs({
      resetOffset: true,
      nextQ: debouncedQ,
      nextOffset: 0,
    });
  }, [debouncedQ, q, loadLogs]);

  const canGoPrev = offset > 0;
  const canGoNext = offset + logs.length < total;

  const exportCsv = async () => {
    try {
      setFeedback("");
      const params = buildAuditParams({ format: "csv" });
      const response = await fetch(`${API_BASE_URL}/admin/audit-logs?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let payload;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        throw new Error(payload?.message || "Failed to export CSV");
      }

      const csvText = await response.text();
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `admin-audit-logs-${now}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const applyFilters = async (event) => {
    event.preventDefault();
    await loadLogs({ resetOffset: true, nextOffset: 0 });
  };

  const goPrev = async () => {
    if (!canGoPrev) return;
    setOffset((prev) => Math.max(0, prev - Number(limit)));
  };

  const goNext = async () => {
    if (!canGoNext) return;
    setOffset((prev) => prev + Number(limit));
  };

  return (
    <section className="admin-grid">
      <form className="form-grid card-box full-width" onSubmit={applyFilters}>
        <h3 className="full-width">Audit Log Filters</h3>
        <label>
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor, action, or target"
          />
        </label>

        <label>
          Action
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            <option value="user.create">user.create</option>
            <option value="user.role.update">user.role.update</option>
            <option value="user.department.update">user.department.update</option>
          </select>
        </label>

        <label>
          Actor CID
          <input
            value={actorCid}
            onChange={(e) => setActorCid(e.target.value)}
            placeholder="Filter by actor CID"
          />
        </label>

        <label>
          From Date
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>

        <label>
          To Date
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>

        <label>
          Page Size
          <select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>

        <div className="audit-actions">
          <button className="solid-btn" type="submit">
            Apply Filters
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={async () => {
              setQ("");
              setDebouncedQ("");
              setAction("");
              setActorCid("");
              setFrom("");
              setTo("");
              setLimit(25);
              setOffset(0);
              await loadLogs({
                resetOffset: true,
                nextQ: "",
                nextAction: "",
                nextActorCid: "",
                nextFrom: "",
                nextTo: "",
                nextLimit: 25,
                nextOffset: 0,
              });
            }}
          >
            Clear All Filters
          </button>
          <button className="ghost-btn" type="button" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </form>

      <section className="card-box full-width">
        <h3>Audit Logs</h3>
        {loading ? <p className="info-box">Loading audit logs...</p> : null}
        {feedback ? <p className="feedback">{feedback}</p> : null}

        {!loading && !feedback ? (
          <>
            {!logs.length ? (
              <p className="info-box">No audit logs found for current filters.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Target User</th>
                      <th>Changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((entry) => {
                      const isExpanded = expandedRowId === entry.id;
                      return (
                        <Fragment key={entry.id}>
                          <tr
                            className="audit-row"
                            onClick={() => {
                              setExpandedRowId((prev) => (prev === entry.id ? null : entry.id));
                            }}
                          >
                            <td>{new Date(entry.created_at).toLocaleString()}</td>
                            <td>{entry.action}</td>
                            <td>{entry.actor_cid || `#${entry.actor_user_id || "-"}`}</td>
                            <td>{entry.target_cid || `#${entry.target_user_id || "-"}`}</td>
                            <td>{isExpanded ? "Hide Details" : "Show Details"}</td>
                          </tr>
                          {isExpanded ? (
                            <tr className="audit-detail-row">
                              <td colSpan={5}>
                                <div className="audit-detail-grid">
                                  <div className="json-panel">
                                    <h4>Old Values</h4>
                                    <pre className="json-cell json-block">
                                      {entry.old_values
                                        ? JSON.stringify(entry.old_values, null, 2)
                                        : "-"}
                                    </pre>
                                  </div>
                                  <div className="json-panel">
                                    <h4>New Values</h4>
                                    <pre className="json-cell json-block">
                                      {entry.new_values
                                        ? JSON.stringify(entry.new_values, null, 2)
                                        : "-"}
                                    </pre>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="audit-pagination">
              <button className="ghost-btn" type="button" disabled={!canGoPrev} onClick={goPrev}>
                Previous
              </button>
              <span>
                Offset {offset} - showing {logs.length} of {total} entries
              </span>
              <button className="ghost-btn" type="button" disabled={!canGoNext} onClick={goNext}>
                Next
              </button>
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}

export default AdminAuditLogs;