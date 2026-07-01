import { LoaderCircle } from "lucide-react";

type PageStateProps = {
  title: string;
  description: string;
};

type ErrorStateProps = PageStateProps & {
  actionLabel?: string;
  onAction?: () => void;
};

export function PageLoadingState({ title, description }: PageStateProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center rounded border border-gray-200 bg-white p-6">
      <div className="text-center">
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-blue-700" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}

export function PageEmptyState({ title, description }: PageStateProps) {
  return (
    <div className="rounded border border-dashed border-gray-300 bg-white p-8 text-center">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
    </div>
  );
}

export function PageErrorState({ title, description, actionLabel, onAction }: ErrorStateProps) {
  return (
    <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
      <h2 className="text-base font-semibold text-red-900">{title}</h2>
      <p className="mt-1 text-sm text-red-700">{description}</p>
      {onAction && actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}