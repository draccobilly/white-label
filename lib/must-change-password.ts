/** Set on the Supabase user with the service role. The person cannot clear it. */
export const MUST_CHANGE_PASSWORD = "must_change_password";

export function mustChangePassword(user: {
  app_metadata?: Record<string, unknown> | null;
}) {
  return user.app_metadata?.[MUST_CHANGE_PASSWORD] === true;
}
