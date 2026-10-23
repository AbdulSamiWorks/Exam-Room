import type { StudentSessionResponse } from '@exam-room/shared';
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { postJson } from '../../api/http-client';

const PASSKEYS_PATH = '/student-auth/passkeys';
const FINGERPRINT_STORAGE_KEY = 'exam-room:fingerprint';

export type FingerprintChoice = 'ready' | 'declined';

type OptionsResponse<Options> = {
  options: Options;
};

export async function canUseFingerprint(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false;
  return platformAuthenticatorIsAvailable().catch(() => false);
}

export async function setUpFingerprint(): Promise<void> {
  const { options } = await postJson<OptionsResponse<PublicKeyCredentialCreationOptionsJSON>>(
    `${PASSKEYS_PATH}/registration-options`,
  );
  const registration = await startRegistration({ optionsJSON: options });
  await postJson(`${PASSKEYS_PATH}/registrations`, registration);
  saveFingerprintChoice('ready');
}

export async function logInWithFingerprint(): Promise<StudentSessionResponse> {
  const { options } = await postJson<OptionsResponse<PublicKeyCredentialRequestOptionsJSON>>(
    `${PASSKEYS_PATH}/login-options`,
  );
  const authentication = await startAuthentication({ optionsJSON: options });
  return postJson<StudentSessionResponse>(`${PASSKEYS_PATH}/login`, authentication);
}

export function readFingerprintChoice(): FingerprintChoice | undefined {
  try {
    const choice = window.localStorage.getItem(FINGERPRINT_STORAGE_KEY);
    return choice === 'ready' || choice === 'declined' ? choice : undefined;
  } catch {
    return undefined;
  }
}

export function saveFingerprintChoice(choice: FingerprintChoice | undefined): void {
  try {
    if (choice) window.localStorage.setItem(FINGERPRINT_STORAGE_KEY, choice);
    else window.localStorage.removeItem(FINGERPRINT_STORAGE_KEY);
  } catch {
    return;
  }
}

export function describeFingerprintError(error: unknown): string {
  if (error instanceof Error && error.name === 'NotAllowedError') {
    return 'The fingerprint was cancelled. Try again, or use your PIN.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Use your PIN.';
}
