import { showErrorToast } from "./toast";

export type ErrorType = "network" | "contract" | "validation" | "unknown";

export class AppError extends Error {
  readonly type: ErrorType;
  readonly context: string;
  readonly timestamp: number;
  readonly originalError: unknown;

  constructor(params: {
    type: ErrorType;
    context: string;
    message: string;
    originalError?: unknown;
  }) {
    super(params.message);
    this.name = "AppError";
    this.type = params.type;
    this.context = params.context;
    this.timestamp = Date.now();
    this.originalError = params.originalError;
  }
}

export function classifyError(err: unknown): ErrorType {
  if (err instanceof AppError) return err.type;
  if (err instanceof TypeError) return "network";
  if (
    err instanceof Error &&
    (err.message.toLowerCase().includes("network") ||
      err.message.toLowerCase().includes("fetch") ||
      err.message.toLowerCase().includes("timeout"))
  ) {
    return "network";
  }
  if (
    err instanceof Error &&
    (err.message.toLowerCase().includes("invalid") ||
      err.message.toLowerCase().includes("required") ||
      err.message.toLowerCase().includes("not connected"))
  ) {
    return "validation";
  }
  return "contract";
}

function extractMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "An unexpected error occurred";
}

export function createErrorHandler(context: string) {
  function captureError(error: unknown) {
    const type = classifyError(error);
    const message = extractMessage(error);
    console.error(
      `[${new Date().toISOString()}] [${context}] [${type}] ${message}`,
      error,
    );
    return new AppError({ type, context, message, originalError: error });
  }

  function handleError(error: unknown, action?: string): AppError {
    const appError = captureError(error);
    if (action) {
      showErrorToast(action, appError);
    }
    return appError;
  }

  function handleMutationError(error: unknown, action: string) {
    const appError = captureError(error);
    showErrorToast(action, appError);
  }

  return { captureError, handleError, handleMutationError };
}
