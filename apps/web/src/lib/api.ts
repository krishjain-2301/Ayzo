import { supabase } from './supabase';

let envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
if (envUrl.includes('127.0.0.1')) {
  envUrl = envUrl.replace('127.0.0.1', 'localhost');
}
export const API_BASE_URL = envUrl.endsWith('/api/v1') ? envUrl : `${envUrl}/api/v1`;

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  let token = null;
  if (typeof window !== 'undefined') {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        token = session.access_token;
        localStorage.setItem('token', session.access_token);
        localStorage.setItem('user', JSON.stringify({
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "User",
          email: session.user.email || "",
          picture: session.user.user_metadata?.avatar_url || "",
        }));
      } else {
        token = localStorage.getItem('token');
      }
    } catch (e) {
      console.error("Error retrieving Supabase session:", e);
      token = localStorage.getItem('token');
    }
  }
  
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
      try {
        await supabase.auth.signOut();
      } catch (e) {}
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
