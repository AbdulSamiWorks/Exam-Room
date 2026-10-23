export type PhonePlatform = 'android' | 'iphone' | 'other';

const IPHONE_OR_IPAD = /iPhone|iPad|iPod/;
const ANDROID = /Android/;
const MAC = /Macintosh/;

export function detectPhonePlatform(userAgent: string, maxTouchPoints: number): PhonePlatform {
  if (ANDROID.test(userAgent)) return 'android';
  if (IPHONE_OR_IPAD.test(userAgent) || (MAC.test(userAgent) && maxTouchPoints > 1)) {
    return 'iphone';
  }
  return 'other';
}

export function currentPhonePlatform(): PhonePlatform {
  return detectPhonePlatform(navigator.userAgent, navigator.maxTouchPoints);
}

export function isInstalledApp(): boolean {
  const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
  const isIphoneHomeScreenApp = 'standalone' in navigator && navigator.standalone === true;
  return isStandaloneDisplay || isIphoneHomeScreenApp;
}
