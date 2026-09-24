import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import api from '@/lib/api';
import type { AuthResponse, Passkey } from '@/types';

/** Whether this browser supports the WebAuthn API at all. */
export function passkeySupported(): boolean {
  return typeof window !== 'undefined' && browserSupportsWebAuthn();
}

/** Whether a platform authenticator (Touch ID / Windows Hello / etc.) is present. */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

/**
 * Enrol a new passkey for the currently authenticated user.
 * Prompts the OS/browser biometric or security-key ceremony.
 * `password` is required: the server re-verifies the account password at
 * the verify step so a hijacked session cannot enrol an attacker passkey.
 */
export async function enrollPasskey(name?: string, password?: string): Promise<Passkey> {
  const { data: options } = await api.post('/auth/passkey/register/options');
  const attResp = await startRegistration({ optionsJSON: options });
  const { data } = await api.post('/auth/passkey/register/verify', {
    response: attResp,
    name,
    password,
  });
  return data;
}

/** Fetch the current user's registered passkeys. */
export async function listPasskeys(): Promise<Passkey[]> {
  const { data } = await api.get('/auth/passkey');
  return data;
}

/** Rename a passkey. */
export async function renamePasskey(id: string, name: string): Promise<Passkey> {
  const { data } = await api.patch(`/auth/passkey/${id}`, { name });
  return data;
}

/** Remove a passkey. */
export async function removePasskey(id: string): Promise<void> {
  await api.delete(`/auth/passkey/${id}`);
}

/**
 * Log in with a passkey. `email` is optional — when omitted the browser offers
 * any discoverable passkey for this site (usernameless flow).
 * Returns the user; session credentials are set as httpOnly cookies.
 */
export async function loginWithPasskey(email?: string): Promise<AuthResponse> {
  const { data } = await api.post('/auth/passkey/login/options', { email });
  const { flowId, options } = data;
  const authResp = await startAuthentication({ optionsJSON: options });
  const { data: result } = await api.post<AuthResponse>('/auth/passkey/login/verify', {
    flowId,
    response: authResp,
  });
  return result;
}
