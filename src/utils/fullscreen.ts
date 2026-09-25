/**
 * Mecha Clash - Automatic Mobile Fullscreen & Orientation Utilities
 */

interface VendorDocument extends Document {
  webkitFullscreenElement?: Element;
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
}

interface VendorElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

/**
 * Returns whether Fullscreen API is actively engaged
 */
export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as VendorDocument;
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

/**
 * Checks if the browser supports standard or vendor-prefixed Fullscreen API
 */
export function supportsFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as VendorDocument;
  return Boolean(
    doc.fullscreenEnabled ||
    doc.webkitFullscreenEnabled ||
    doc.mozFullScreenEnabled ||
    doc.msFullscreenEnabled ||
    document.documentElement.requestFullscreen ||
    (document.documentElement as VendorElement).webkitRequestFullscreen
  );
}

/**
 * Silently attempts to lock orientation to landscape on mobile
 */
export function tryLockLandscape() {
  try {
    if (
      typeof screen !== 'undefined' &&
      screen.orientation &&
      typeof (screen.orientation as any).lock === 'function'
    ) {
      (screen.orientation as any).lock('landscape').catch(() => {
        // Silently catch unsupported orientation locks without errors
      });
    }
  } catch {
    // Ignored
  }
}

/**
 * Automatically requests fullscreen on the target element (or document.documentElement)
 * and attempts landscape orientation lock when supported.
 * MUST be invoked directly from the user's tap gesture (e.g. Play / Start button).
 * If rejected, unsupported, or denied, silently catches and returns false so game starts normally.
 */
export async function requestAppFullscreen(targetElement?: HTMLElement | null): Promise<boolean> {
  const el = (targetElement || document.documentElement) as VendorElement;
  if (!el) return false;

  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      await el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen();
    } else {
      return false;
    }

    // Attempt landscape lock only after entering fullscreen
    tryLockLandscape();
    return true;
  } catch {
    // Graceful fallback: browser denied or unsupported - never block gameplay
    return false;
  }
}

/**
 * Exits fullscreen safely if needed
 */
export async function exitAppFullscreen(): Promise<boolean> {
  const doc = document as VendorDocument;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }

    try {
      if (screen.orientation && typeof screen.orientation.unlock === 'function') {
        screen.orientation.unlock();
      }
    } catch {
      // Ignored
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggles fullscreen on the root container / document
 */
export async function toggleAppFullscreen(targetElement?: HTMLElement | null): Promise<boolean> {
  if (isFullscreenActive()) {
    return exitAppFullscreen();
  } else {
    return requestAppFullscreen(targetElement);
  }
}

/**
 * Detects if the client is a mobile device (Android phones/tablets, iPhone, iPad).
 * Strictly excludes Desktop OSes (Windows, macOS, Linux, desktop Chrome/Edge) so desktop remains completely unchanged.
 */
export function isMobileClient(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();

  // Desktop OS check: desktop Windows/Mac/Linux must NEVER be forced into fullscreen
  const isDesktopOS =
    /windows nt|macintosh|mac os x|cros|x11; linux x86_64/i.test(ua) &&
    !/android|mobile|tablet/i.test(ua);

  if (isDesktopOS) {
    return false;
  }

  const isMobileUA = /android|iphone|ipad|ipod|mobile|silk|kindle|tablet/i.test(ua);
  const isTouch =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches;

  return isMobileUA || (isTouch && window.innerWidth <= 1024);
}
