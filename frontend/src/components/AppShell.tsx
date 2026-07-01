import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getApiErrorMessage } from "../lib/api";
import { setPostLoginRedirect, useAuth } from "../providers/AuthProvider";
import { AuthLoadingScreen } from "./auth/AuthLoadingScreen";

const nav = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/contacts", label: "Contacts" },
  { to: "/opportunities", label: "Opportunities" },
  { to: "/tasks", label: "Tasks" },
  { to: "/inbox", label: "Inbox" },
  { to: "/assistant", label: "AI Assistant" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { currentTenant, currentUser, loading, logout, onboardingRequired } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!currentUser) {
      setPostLoginRedirect(pathname);
      void navigate({ to: "/login", replace: true });
      return;
    }

    if (onboardingRequired) {
      void navigate({ to: "/onboarding", replace: true });
    }
  }, [currentUser, loading, navigate, onboardingRequired, pathname]);

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!currentUser) {
    return <AuthLoadingScreen description="Redirecting to sign in..." />;
  }

  if (onboardingRequired) {
    return <AuthLoadingScreen description="Redirecting to onboarding..." />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <aside className="w-56 border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-4">
          <span className="font-semibold text-blue-700">AIHub</span>
        </div>
        <nav className="space-y-1 p-2">
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");

            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "block rounded px-3 py-2 text-sm " +
                  (active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-xs text-gray-500">
              {currentTenant?.name ?? "AIHub"} - {currentUser.email}
            </p>
          </div>
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={async () => {
              setIsLoggingOut(true);

              try {
                await logout();
                await navigate({ to: "/login", replace: true });
              } catch (error) {
                toast.error(getApiErrorMessage(error, "We could not sign you out."));
              } finally {
                setIsLoggingOut(false);
              }
            }}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoggingOut ? "Signing out..." : "Logout"}
          </button>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
