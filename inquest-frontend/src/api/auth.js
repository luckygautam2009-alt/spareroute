const SR_URL = import.meta.env.VITE_SPAREROUTE_API_URL || 'http://localhost:4000/api';
const KEY = 'inquest_auth';

function read() {
  try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch { return null; }
}
function write(v) {
  try { v ? sessionStorage.setItem(KEY, JSON.stringify(v)) : sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

export const getUser = () => read()?.user || null;
export const getAccessToken = () => read()?.accessToken || null;

export async function login(phone, password) {
  const res = await fetch(`${SR_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error || 'Login failed');
  const { user, accessToken, refreshToken } = json.data;
  write({ user, accessToken, refreshToken });
  return user;
}

export async function refreshAccessToken() {
  const s = read();
  if (!s?.refreshToken) return false;
  const res = await fetch(`${SR_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: s.refreshToken }),
  });
  if (!res.ok) { write(null); return false; }
  const json = await res.json();
  write({ ...s, accessToken: json.data.accessToken, refreshToken: json.data.refreshToken });
  return true;
}

export function logout() {
  const s = read();
  if (s) {
    fetch(`${SR_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.accessToken}` },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
    }).catch(() => {});
  }
  write(null);
}
