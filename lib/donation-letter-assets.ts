/**
 * Images embedded in the donation acknowledgment letter (PDF).
 * Replace both images with this organization's logo and signer mark
 * (PNG with a transparent background) before sending letters.
 *
 * 1×1 transparent PNG placeholders so the letter module still compiles.
 */

const TRANSPARENT_PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const LETTER_LOGO = {
  width: 200,
  height: 60,
  base64: [TRANSPARENT_PIXEL],
};

export const LETTER_SIGNATURE = {
  width: 180,
  height: 60,
  base64: [TRANSPARENT_PIXEL],
};
