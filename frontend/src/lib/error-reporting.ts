type AppErrorOptions = {
  extra?: Record<string, unknown>;
};

type AppEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: AppErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __appEvents?: AppEvents;
  }
}

export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.__appEvents?.captureException?.(error, context, {
    extra: {
      url: window.location.href,
    },
  });
}
