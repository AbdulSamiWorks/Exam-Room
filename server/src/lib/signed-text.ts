import { createHmac } from 'node:crypto';
import { constantTimeEquals } from './crypto.js';

const SIGNATURE_SEPARATOR = '.';

export function signText(secret: string, purpose: string, text: string): string {
  return `${text}${SIGNATURE_SEPARATOR}${signatureOf(secret, purpose, text)}`;
}

export function readSignedText(
  secret: string,
  purpose: string,
  signedText: string | undefined,
): string | undefined {
  if (!signedText) return undefined;
  const separatorIndex = signedText.lastIndexOf(SIGNATURE_SEPARATOR);
  if (separatorIndex === -1) return undefined;

  const text = signedText.slice(0, separatorIndex);
  const signature = signedText.slice(separatorIndex + 1);
  return constantTimeEquals(signature, signatureOf(secret, purpose, text)) ? text : undefined;
}

function signatureOf(secret: string, purpose: string, text: string): string {
  return createHmac('sha256', secret).update(`${purpose}:${text}`).digest('base64url');
}
