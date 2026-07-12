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
    if (err.response?.status === 401 && !err.config._retry) {
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
    // Normalize the real backend error message + ID onto the error object so
    // every call site can show the customer something specific and reportable
    // instead of a generic "something went wrong".
    const data = err.response?.data;
    err.userMessage = data?.error || data?.detail || err.message || "Something went wrong.";
    err.errorId = data?.error_id || null;
    return Promise.reject(err);
  }
);

export default api;
