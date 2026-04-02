import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { apiRequest } from "../../api.js";
import { ISTANBUL_CENTER, STATUS_CLASS, issueMarkerIcon } from "../../constants";
import IssueDetailModal from "../../components/shared/IssueDetailModal";

function MyReports({ token, refreshKey }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState(null);

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
        const result = await apiRequest({ path: "/issues/my", token });
        if (mounted) {
          setIssues(result.issues || []);
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [refreshKey, token]);

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

  if (loading) return <p className="info-box">Loading reports...</p>;
  if (error) return <p className="info-box">{error}</p>;
  if (!issues.length) return <p className="info-box">No reports yet.</p>;

  return (
    <section className="all-issues-layout">
      {mappedIssues.length ? (
        <section className="all-issues-map-card" aria-label="My reports map">
          <div className="all-issues-map-head">
            <h3>My Reports Map</h3>
            <p>{mappedIssues.length} mapped reports</p>
          </div>
          <MapContainer
            key={`my-reports-map-${mappedIssues.length}`}
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
                  <strong>{item.title}</strong>
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

      <div className="report-list">
        {issues.map((item) => (
          <article
            className="report-card report-card--clickable"
            key={item.id}
            onClick={() => openIssueDetails(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openIssueDetails(item.id);
              }
            }}
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
              <span>Department: {item.assigned_department_name || "Unassigned"}</span>
              <span>{new Date(item.created_at).toLocaleString()}</span>
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

      {selectedIssueId ? (
        <IssueDetailModal issueId={selectedIssueId} token={token} onClose={closeIssueDetails} />
      ) : null}
    </section>
  );
}

export default MyReports;
