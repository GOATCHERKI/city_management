import { useMemo, useState } from "react";
import MapPicker from "../MapPicker.jsx";
import { apiRequest } from "../../api.js";

function ReportIssueForm({ token, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const canSubmit = useMemo(
    () => Boolean(title && description && category && location.lat && location.lng),
    [category, description, location.lat, location.lng, title],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

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
        path: "/issues",
        method: "POST",
        token,
        body: {
          title,
          description,
          category,
          latitude: location.lat,
          longitude: location.lng,
          photo_url: photoUrl,
        },
      });

      setFeedback("Issue submitted successfully.");
      setTitle("");
      setDescription("");
      setCategory("");
      setLocation({ lat: null, lng: null });
      setFile(null);
      onCreated();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>

      <label>
        Category
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. streetlight, pothole, drainage"
          required
        />
      </label>

      <label className="full-width">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          required
        />
      </label>

      <label className="full-width">
        Photo (optional)
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>

      <div className="full-width">
        <p className="hint">Click map to set location.</p>
        <MapPicker value={location} onChange={setLocation} />
        <p className="coords">
          Latitude: <strong>{location.lat ?? "-"}</strong> | Longitude: <strong>{location.lng ?? "-"}</strong>
        </p>
      </div>

      <button className="solid-btn" disabled={!canSubmit || loading}>
        {loading ? "Submitting..." : "Submit Issue"}
      </button>

      {feedback ? <p className="feedback">{feedback}</p> : null}
    </form>
  );
}

export default ReportIssueForm;
