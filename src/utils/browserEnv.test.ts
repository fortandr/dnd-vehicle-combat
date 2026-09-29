import { describe, it, expect } from 'vitest';
import { isInAppBrowser, shouldFallbackToRedirect } from './browserEnv';

const REDDIT_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Reddit/Version 2024.20.0/Build 1234/iOS';
const REDDIT_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36; wv Reddit/2024.20.0';
const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 13; SM-S911B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36';
const INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0';
const DISCORD =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 Discord-Android/230';
const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAC_FIREFOX = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0';

describe('isInAppBrowser', () => {
  it.each([
    ['Reddit iOS', REDDIT_IOS],
    ['Reddit Android', REDDIT_ANDROID],
    ['generic Android WebView', ANDROID_WEBVIEW],
    ['Instagram', INSTAGRAM],
    ['Discord Android', DISCORD],
  ])('detects %s as an in-app browser', (_name, ua) => {
    expect(isInAppBrowser(ua)).toBe(true);
  });

  it.each([
    ['iOS Safari', IOS_SAFARI],
    ['Android Chrome', ANDROID_CHROME],
    ['macOS Chrome', MAC_CHROME],
    ['macOS Firefox', MAC_FIREFOX],
  ])('does not flag %s', (_name, ua) => {
    expect(isInAppBrowser(ua)).toBe(false);
  });

  it('treats an empty user agent as a normal browser', () => {
    expect(isInAppBrowser('')).toBe(false);
  });
});

describe('shouldFallbackToRedirect', () => {
  it.each(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'])(
    'falls back on %s',
    (code) => {
      expect(shouldFallbackToRedirect({ code })).toBe(true);
    },
  );

  it('does not fall back when the user simply closed the popup', () => {
    expect(shouldFallbackToRedirect({ code: 'auth/popup-closed-by-user' })).toBe(false);
    expect(shouldFallbackToRedirect({ code: 'auth/cancelled-popup-request' })).toBe(false);
  });

  it('does not fall back on unrelated errors or non-Firebase errors', () => {
    expect(shouldFallbackToRedirect({ code: 'auth/network-request-failed' })).toBe(false);
    expect(shouldFallbackToRedirect(new Error('boom'))).toBe(false);
    expect(shouldFallbackToRedirect(null)).toBe(false);
  });
});
