import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { toast } from "sonner";
import { getApiErrorMessage, subscribeToAuthExpired } from "../lib/api";
import { authService } from "../services/auth";
import type { MeResponse, Tenant, User } from "../types/auth";

type RefreshUserOptions = {
  silent?: boolean;
};

type AuthContextValue = {
  currentUser: User | null;
  currentTenant: Tenant | null;
  loading: boolean;
  initialized: boolean;
  onboardingRequired: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (options?: RefreshUserOptions) => Promise<MeResponse | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const clearPostLoginRedirect = () => {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem("aihub:post-login-redirect");
  }
};

export const setPostLoginRedirect = (path: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem("aihub:post-login-redirect", path);
};

export const getPostLoginRedirect = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem("aihub:post-login-redirect");
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const applySession = (session: MeResponse | null) => {
    setCurrentUser(session?.user ?? null);
    setCurrentTenant(session?.user.tenant ?? null);
    setOnboardingRequired(session?.onboardingRequired ?? false);
  };

  const refreshUser = async (options?: RefreshUserOptions) => {
    setLoading(true);

    try {
      const session = await authService.getMe();
      applySession(session);
      return session;
    } catch (error) {
      applySession(null);

      if (!options?.silent) {
        toast.error(getApiErrorMessage(error, "We could not restore your session."));
      }

      return null;
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  const login = async () => {
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname + window.location.search;
      const existingRedirect = getPostLoginRedirect();

      if (!existingRedirect || existingRedirect === "/login" || existingRedirect === "/") {
        setPostLoginRedirect(currentPath);
      }
    }

    const url = await authService.getGoogleConsentUrl();
    window.location.assign(url);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "We could not sign you out cleanly."));
    } finally {
      applySession(null);
      clearPostLoginRedirect();
    }
  };

  useEffect(() => {
    void refreshUser({ silent: true });
  }, []);

  useEffect(() => {
    return subscribeToAuthExpired(() => {
      applySession(null);
      toast.error("Your session expired. Please sign in again.");

      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentTenant,
        loading,
        initialized,
        onboardingRequired,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
