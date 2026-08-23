/**
 * api.js — Centralized fetch wrapper for backend API
 */

const API_BASE = (window.BACKEND_URL || localStorage.getItem('INBOXAI_BACKEND_URL') || '').replace(/\/$/, '');

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const url = API_BASE ? `${API_BASE}${path}` : path;

  const res = await fetch(url, {
    credentials: 'include', // Needed for cross-origin session cookies (Vercel -> Render)
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    // Session expired — redirect to login
    window.location.href = '/';
    return;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }

  return data;
}

// ─── Auth ─────────────────────────────────────────────────
const AuthAPI = {
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getAuthUrl: () => (API_BASE ? `${API_BASE}/auth/google` : '/auth/google'),
};

// ─── Emails ───────────────────────────────────────────────
const EmailAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/emails?${qs}`);
  },
  get: (id) => request(`/api/emails/${id}`),
  markRead: (id, read) => request(`/api/emails/${id}/read`, { method: 'PATCH', body: { read } }),
  toggleStar: (id, starred) => request(`/api/emails/${id}/star`, { method: 'PATCH', body: { starred } }),
  archive: (id) => request(`/api/emails/${id}/archive`, { method: 'PATCH' }),
  delete: (id) => request(`/api/emails/${id}`, { method: 'DELETE' }),
  send: (data) => request('/api/emails/send', { method: 'POST', body: data }),
  reply: (id, body) => request(`/api/emails/${id}/reply`, { method: 'POST', body: { body } }),
};

// ─── AI ───────────────────────────────────────────────────
const AIAPI = {
  summarize: (data) => request('/api/ai/summarize', { method: 'POST', body: data }),
  generateReply: (data) => request('/api/ai/reply', { method: 'POST', body: data }),
  classify: (data) => request('/api/ai/classify', { method: 'POST', body: data }),
  generateSubject: (data) => request('/api/ai/subject', { method: 'POST', body: data }),
};
