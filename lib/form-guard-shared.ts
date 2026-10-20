/** How long the page must be open before a public form is accepted. */
export const FORM_MIN_AGE_MS = 2000;

/** A token older than this belongs to a tab that was left open. */
export const FORM_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const FORM_RELOAD_ERROR = "Please reload the page and try again.";
export const FORM_SENTENCE_ERROR =
  "Please describe that in a full sentence, not a single code.";
export const FORM_CODE_ERROR =
  "Enter the tracking code from your confirmation email. It starts with DN and has 8 numbers.";
export const FORM_EMAIL_ERROR =
  "Use the email from your donation. Remove the extra dots.";
