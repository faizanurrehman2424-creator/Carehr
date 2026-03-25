import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!err.response) {
      (err as any).isNetworkError = true;
    }
    return Promise.reject(err);
  }
);

export default api;
