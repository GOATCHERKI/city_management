export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const buildErrorMessage = (payload, fallback) => {
  if (!payload) return fallback;

  if (Array.isArray(payload.errors) && payload.errors.length) {
    const joined = payload.errors
      .map((item) => `${item.path || "field"}: ${item.message}`)
      .join("; ");
    return `${payload.message || fallback} ${joined}`.trim();
  }

  return payload.message || fallback;
};

export const apiRequest = async ({
  path,
  method = "GET",
  token,
  body,
  isFormData = false,
}) => {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(buildErrorMessage(payload, "Request failed"));
  }

  return payload;
};
