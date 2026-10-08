const envUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
export const API_BASE_URL = envUrl.endsWith("/api/v1") ? envUrl : `${envUrl}/api/v1`;

/** Turn a FastAPI error body into one readable sentence. */
function errorText(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { msg?: string; loc?: unknown[] }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg ?? ""}`.replace(/^: /, ""))
      .join("; ");
  }
  return fallback;
}

/**
 * Call the AYZO API. Local mode: no auth. A JSON body sets its own header;
 * FormData is sent as-is so the browser can add the multipart boundary.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  } catch {
    throw new Error("Cannot reach the AYZO API. Is it running on port 8000?");
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      /* not JSON */
    }
    throw new Error(errorText(body, `Request failed (${response.status})`));
  }
  return response.status === 204 ? (null as T) : response.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const post = <T = any>(endpoint: string, body?: unknown) =>
  apiFetch<T>(endpoint, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const patch = <T = any>(endpoint: string, body: unknown) =>
  apiFetch<T>(endpoint, { method: "PATCH", body: JSON.stringify(body) });

export const del = (endpoint: string) => apiFetch<null>(endpoint, { method: "DELETE" });
