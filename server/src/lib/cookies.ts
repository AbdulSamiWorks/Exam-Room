export function readCookie(
  cookieHeader: string | undefined,
  cookieName: string,
): string | undefined {
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex === -1) continue;
    if (cookie.slice(0, separatorIndex).trim() === cookieName) {
      return cookie.slice(separatorIndex + 1).trim();
    }
  }
  return undefined;
}
