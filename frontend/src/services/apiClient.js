// Central API client communicating with backend (Port 3001)
export const BACKEND_URL =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? ((window.desktopAPI?.getBackendUrl && window.desktopAPI.getBackendUrl()) || "http://127.0.0.1:3001")
    : "";

export async function apiRequest(endpoint, options = {}) {
  const url = `${BACKEND_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API ${endpoint} failed (${response.status}): ${errorText}`);
  }

  return response.json();
}
