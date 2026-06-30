import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthLoadingScreen } from "../components/auth/AuthLoadingScreen";
import { getApiErrorMessage } from "../lib/api";
import { setPostLoginRedirect, useAuth } from "../providers/AuthProvider";
import { authService } from "../services/auth";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding | AIHub" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { currentUser, loading, onboardingRequired, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("Retail");
  const [size, setSize] = useState("1-10");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!currentUser) {
      setPostLoginRedirect("/onboarding");
      void navigate({ to: "/login", replace: true });
      return;
    }

    if (!onboardingRequired) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [currentUser, loading, navigate, onboardingRequired]);

  useEffect(() => {
    if (currentUser?.tenant.name && currentUser.tenant.name !== "My Business") {
      setName(currentUser.tenant.name);
    }

    if (currentUser?.tenant.industry) {
      setIndustry(currentUser.tenant.industry);
    }

    if (currentUser?.tenant.size) {
      setSize(currentUser.tenant.size);
    }
  }, [currentUser]);

  if (loading || !currentUser || !onboardingRequired) {
    return <AuthLoadingScreen description="Loading your onboarding flow..." />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const trimmedName = name.trim();

          if (!trimmedName) {
            setError("Business name is required.");
            return;
          }

          setError(null);
          setIsSubmitting(true);

          try {
            await authService.completeOnboarding({
              name: trimmedName,
              industry,
              size,
            });
            await refreshUser({ silent: true });
            toast.success("Your workspace is ready.");
            await navigate({ to: "/dashboard", replace: true });
          } catch (submitError) {
            toast.error(
              getApiErrorMessage(submitError, "We could not save your onboarding details."),
            );
          } finally {
            setIsSubmitting(false);
          }
        }}
        className="w-full max-w-md rounded border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-4 text-lg font-semibold">Tell us about your business</h1>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700">Business Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
          </div>
          <div>
            <label className="block text-sm text-gray-700">Industry</label>
            <select
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option>Retail</option>
              <option>SaaS</option>
              <option>Real Estate</option>
              <option>Healthcare</option>
              <option>Education</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700">Business Size</label>
            <select
              value={size}
              onChange={(event) => setSize(event.target.value)}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option>1-10</option>
              <option>11-50</option>
              <option>51-200</option>
              <option>200+</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-5 w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
