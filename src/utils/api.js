import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';

const api = axios.create({
  baseURL: API_ENDPOINTS.base,
});

const AUTH_STORAGE_KEYS = ["user", "customer", "accessToken", "refreshToken"];

const clearStoredAuth = () => {
  AUTH_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

// Where this session's tokens live. A "keep me logged in" login writes to localStorage;
// otherwise sessionStorage. Resolved per call rather than cached, because the choice is
// made at login and this module outlives it.
const tokenStore = () => (localStorage.getItem('refreshToken') ? localStorage : sessionStorage);

const readToken = (key) => localStorage.getItem(key) || sessionStorage.getItem(key);

/**
 * The single in-flight refresh.
 *
 * The server ROTATES the refresh token on every use and checks it against the copy stored
 * on the user row (AuthService.refreshToken: `user.refresh_token !== token` -> reject). So
 * a refresh token is strictly single-use.
 *
 * Without this lock, returning to the site with an expired access token was a race: the
 * page fires several authenticated requests at once, all get 401 together, and each one
 * calls /refresh-token with the SAME token. The first rotates it; the rest present a token
 * that no longer matches, get "Invalid refresh token", and wipe the session — so the user
 * is bounced to login even though their session was perfectly renewable.
 *
 * That is why it only happened on *some* pages: a page making one authenticated request
 * never raced, a page making several always did.
 *
 * Now the first 401 owns the refresh and everyone else awaits the same promise.
 */
let refreshPromise = null;

const refreshAccessToken = () => {
  if (refreshPromise) return refreshPromise;

  const refreshToken = readToken('refreshToken');
  if (!refreshToken) return Promise.reject(new Error('No refresh token'));

  refreshPromise = axios
    // Bare axios, not `api` — a 401 from the refresh endpoint itself must not re-enter
    // this interceptor and recurse.
    .post(`${API_ENDPOINTS.auth}/refresh-token`, { token: refreshToken })
    .then((res) => {
      const { accessToken, refreshToken: nextRefreshToken } = res.data || {};
      if (!accessToken) throw new Error('Refresh returned no access token');

      const storage = tokenStore();
      storage.setItem('accessToken', accessToken);
      // The rotated token MUST be persisted before any queued request retries — the old
      // one is already dead server-side.
      if (nextRefreshToken) storage.setItem('refreshToken', nextRefreshToken);

      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      return accessToken;
    })
    .finally(() => {
      // Cleared either way: a failed refresh must not pin every later request to the
      // same rejected promise for the rest of the session.
      refreshPromise = null;
    });

  return refreshPromise;
};

api.interceptors.request.use(
  (config) => {
    const token = readToken('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    try {
      const accessToken = await refreshAccessToken();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch {
      // The session is genuinely gone (refresh expired, revoked, or absent).
      clearStoredAuth();
      // Guard against a redirect loop: already on /login means the login page itself made
      // the failing call, and navigating again would reload it forever.
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?refresh=session';
      }
      return Promise.reject(error);
    }
  },
);

export default api;
