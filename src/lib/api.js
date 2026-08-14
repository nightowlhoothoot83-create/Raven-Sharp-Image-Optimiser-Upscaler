import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}/api`
    : "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  res => res,
  async err => {
    const requestUrl = String(err.config?.url || "");
    const isAuthProbe = requestUrl.includes("/auth/me");
    const isRefresh = requestUrl.includes("/auth/refresh");

    // A 401 from /auth/me is the normal logged-out state. Never turn that
    // into a refresh request. Likewise, a failed refresh must terminate here
    // rather than recursively refreshing itself.
    if (err.response?.status === 401 && !err.config?._retry && !isAuthProbe && !isRefresh) {
      err.config._retry = true;
      try {
        await api.post("/auth/refresh", {}, { withCredentials: true });
        return api(err.config);
      } catch {
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
    }

    const data = err.response?.data;
    err.userMessage = data?.error || data?.detail || err.message || "Something went wrong.";
    err.errorId = data?.error_id || null;
    return Promise.reject(err);
  }
);

export default api;
