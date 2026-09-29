/**
 * Browser environment helpers
 *
 * Detects embedded "in-app" browsers (Reddit, Instagram, Discord, generic
 * WebViews). Google refuses to run OAuth inside these, and they usually block
 * popup windows, so sign-in silently fails. Callers use this to show a
 * "open in your real browser" notice and to prefer the redirect flow.
 */

const IN_APP_BROWSER_PATTERNS: RegExp[] = [
  /\bReddit\b/i, // Reddit iOS + Android
  /\bInstagram\b/i,
  /\bFBAN\b|\bFBAV\b|\bFB_IAB\b/i, // Facebook / Messenger
  /\bDiscord-?Android\b|\bDiscord\b/i,
  /\bTwitter\b|\bTwitterAndroid\b/i,
  /\bLine\//i,
  /\bSnapchat\b/i,
  /\bTikTok\b|\bmusical_ly\b/i,
  /; ?wv\)/, // Android System WebView marker: "...; wv)"
  /\bwv\b.*\bReddit\b/i,
];

/** True when the user agent belongs to an embedded in-app browser. */
export function isInAppBrowser(userAgent: string | undefined | null): boolean {
  if (!userAgent) return false;
  return IN_APP_BROWSER_PATTERNS.some((re) => re.test(userAgent));
}

/**
 * Firebase Auth error codes that mean "the popup flow can't work here, but a
 * full-page redirect might". Cancellations by the user are deliberately not
 * included: retrying with a redirect would hijack the page they just declined.
 */
const REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

/** True when a failed signInWithPopup should be retried with signInWithRedirect. */
export function shouldFallbackToRedirect(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && REDIRECT_FALLBACK_CODES.has(code);
}
