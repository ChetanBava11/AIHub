import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const apiBaseUrl = import.meta.env.VITE_API_URL || undefined;

export type ApiErrorResponse = {
  message?: string;
  details?: unknown;
};

type AppRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

const AUTH_EXPIRED_EVENT = "aihub:auth-expired";

const emitAuthExpired = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
};

const isRefreshRequest = (url?: string) => url?.includes("/auth/refresh") ?? false;

const shouldAttemptRefresh = (error: AxiosError<ApiErrorResponse>) => {
  const originalRequest = error.config as AppRequestConfig | undefined;
  const status = error.response?.status;

  return (
    status === 401 &&
    !!originalRequest &&
    !originalRequest._retry &&
    !originalRequest.skipAuthRefresh &&
    !isRefreshRequest(originalRequest.url)
  );
};

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

let refreshPromise: Promise<void> | null = null;

const requestRefresh = async () => {
  await api.post(
    "/auth/refresh",
    {},
    {
      skipAuthRefresh: true,
    } as AppRequestConfig,
  );
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    if (!shouldAttemptRefresh(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as AppRequestConfig;
    originalRequest._retry = true;

    refreshPromise ??= requestRefresh()
      .catch((refreshError) => {
        emitAuthExpired();
        throw refreshError;
      })
      .finally(() => {
        refreshPromise = null;
      });

    try {
      await refreshPromise;
      return await api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export const subscribeToAuthExpired = (callback: () => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(AUTH_EXPIRED_EVENT, callback);

  return () => {
    window.removeEventListener(AUTH_EXPIRED_EVENT, callback);
  };
};

export const getApiErrorMessage = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return fallback;
  }

  if (!error.response) {
    return "We could not reach the server. Check your connection and try again.";
  }

  switch (error.response.status) {
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 500:
      return "The server ran into a problem. Please try again shortly.";
    default:
      return error.response.data?.message ?? fallback;
  }
};
