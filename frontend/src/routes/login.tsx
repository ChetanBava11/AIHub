import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthLoadingScreen } from "../components/auth/AuthLoadingScreen";
import { getApiErrorMessage } from "../lib/api";
import {
  clearPostLoginRedirect,
  getPostLoginRedirect,
  useAuth,
} from "../providers/AuthProvider";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "AIHub" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { currentUser, loading, onboardingRequired, login } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && currentUser) {
      const redirectTarget = getPostLoginRedirect();

      if (onboardingRequired) {
        clearPostLoginRedirect();
        void navigate({ to: "/onboarding", replace: true });
        return;
      }

      if (redirectTarget && redirectTarget !== "/" && redirectTarget !== "/login") {
        clearPostLoginRedirect();
        window.location.assign(redirectTarget);
        return;
      }

      clearPostLoginRedirect();
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [currentUser, loading, navigate, onboardingRequired]);

  if (loading || currentUser) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-xl font-semibold text-blue-700">AIHub</div>
          <p className="mt-1 text-sm text-gray-600">AI Business Operations Platform</p>
        </div>
        <button
          type="button"
          disabled={isRedirecting}
          onClick={async () => {
            setIsRedirecting(true);

            try {
              await login();
            } catch (error) {
              setIsRedirecting(false);
              toast.error(getApiErrorMessage(error, "We could not start Google sign-in."));
            }
          }}
          className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isRedirecting ? "Redirecting..." : "Sign in with Google"}
        </button>
      </div>
    </div>
  );
}
