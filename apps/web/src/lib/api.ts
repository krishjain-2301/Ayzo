const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
export const API_BASE_URL = envUrl.endsWith('/api/v1') ? envUrl : `${envUrl}/api/v1`;

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

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
    
    if (response.status === 401 && typeof window !== 'undefined') {
      // Unauthorized, clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    throw new Error(errorMessage);
  }

  // 204 No Content has no body (e.g. DELETE responses)
  if (response.status === 204) {
    return null;
  }

  return response.json();
}
