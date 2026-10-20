export function isAuthError(error: unknown) {
  return (
    error instanceof Error &&
    ["UNAUTHORIZED", "FORBIDDEN", "AUTH_NOT_CONFIGURED"].includes(error.message)
  );
}

export function authHttpStatus(error: unknown) {
  if (error instanceof Error && error.message === "FORBIDDEN") return 403;
  if (isAuthError(error)) return 401;
  return 500;
}

export function authErrorMessage(error: unknown) {
  return error instanceof Error && error.message === "FORBIDDEN"
    ? "Forbidden"
    : "Unauthorized";
}
