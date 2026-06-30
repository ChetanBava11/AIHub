import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Sign in — OpsCRM" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded border border-gray-200 bg-white p-6">
        <div className="mb-6 text-center">
          <div className="text-xl font-semibold text-blue-700">OpsCRM</div>
          <p className="mt-1 text-sm text-gray-600">AI Business Operations Platform</p>
        </div>
        <button
          onClick={() => navigate({ to: "/onboarding" })}
          className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
        >
          Sign in with Google
        </button>
        <p className="mt-4 text-center text-xs text-gray-500">
          Already onboarded?{" "}
          <Link to="/dashboard" className="text-blue-700 hover:underline">
            Go to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
