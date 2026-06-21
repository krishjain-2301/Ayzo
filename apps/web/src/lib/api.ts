const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
export const API_BASE_URL = envUrl.endsWith('/api/v1') ? envUrl : `${envUrl}/api/v1`;

/**
 * Local mode — no auth headers needed.
 * The backend auto-creates and uses a single local user.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch (e) {}

    throw new Error(errorMessage);
  }

  // 204 No Content has no body (e.g. DELETE responses)
  if (response.status === 204) {
    return null;
  }

  return response.json();
}
