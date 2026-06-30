export function AuthLoadingScreen({
  title = "Checking your session",
  description = "Connecting securely to AIHub...",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded border border-gray-200 bg-white p-6 text-center shadow-sm">
        <div className="text-xl font-semibold text-blue-700">AIHub</div>
        <div className="mt-5 flex justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
        </div>
        <h1 className="mt-5 text-lg font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}
