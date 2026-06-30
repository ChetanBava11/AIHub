import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthLoadingScreen } from "../components/auth/AuthLoadingScreen";
import {
  clearPostLoginRedirect,
  getPostLoginRedirect,
  useAuth,
} from "../providers/AuthProvider";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "AIHub" }] }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  const { currentUser, loading, onboardingRequired } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    const redirectTarget = getPostLoginRedirect();

    if (!currentUser) {
      clearPostLoginRedirect();
      void navigate({ to: "/login", replace: true });
      return;
    }

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
  }, [currentUser, loading, navigate, onboardingRequired]);

  return <AuthLoadingScreen description="Preparing your AIHub workspace..." />;
}
