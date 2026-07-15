'use client';

import { useEffect, useState } from 'react';
import {
  Fingerprint,
  KeyRound,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Pencil,
  Check,
  X,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import {
  enrollPasskey,
  listPasskeys,
  removePasskey,
  renamePasskey,
  passkeySupported,
} from '@/lib/passkey';
import type { Passkey } from '@/types';

/** Reusable privacy / data-security notice shown wherever biometrics are used. */
export function BiometricSecurityNotice() {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <ShieldCheck size={18} />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-emerald-900">
            Your biometrics never leave your device
          </p>
          <ul className="space-y-1 text-xs leading-relaxed text-emerald-800">
            <li className="flex gap-1.5">
              <Check size={13} className="mt-0.5 shrink-0" />
              <span>
                Your fingerprint, face or PIN is processed entirely by your device&apos;s
                secure hardware. It is <strong>never</strong> sent to or stored on our servers.
              </span>
            </li>
            <li className="flex gap-1.5">
              <Check size={13} className="mt-0.5 shrink-0" />
              <span>
                We only store a <strong>public key</strong> — a value that can verify your
                sign-ins but can never be used to impersonate you or reconstruct your biometrics.
              </span>
            </li>
            <li className="flex gap-1.5">
              <Check size={13} className="mt-0.5 shrink-0" />
              <span>
                Passkeys are phishing-resistant and unique to this site, following the
                FIDO2 / WebAuthn standard used by banks and governments.
              </span>
            </li>
            <li className="flex gap-1.5">
              <Check size={13} className="mt-0.5 shrink-0" />
              <span>
                You can remove any passkey at any time — this instantly revokes its access.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const supported = passkeySupported();

  const load = async () => {
    try {
      setLoading(true);
      setPasskeys(await listPasskeys());
    } catch {
      setError('Failed to load passkeys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleEnroll = async () => {
    setError('');
    const suggested = `Passkey on ${navigator.platform || 'this device'}`;
    const name = window.prompt('Name this passkey', suggested);
    if (name === null) return; // cancelled
    try {
      setEnrolling(true);
      await enrollPasskey(name || undefined);
      await load();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
        setError('Passkey setup was cancelled.');
      } else {
        setError(err?.response?.data?.message || err?.message || 'Failed to add passkey');
      }
    } finally {
      setEnrolling(false);
    }
  };

  const startRename = (pk: Passkey) => {
    setEditingId(pk.id);
    setEditName(pk.name || '');
  };

  const saveRename = async (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await renamePasskey(id, editName.trim());
      setEditingId(null);
      await load();
    } catch {
      setError('Failed to rename passkey');
    }
  };

  const handleRemove = async (pk: Passkey) => {
    if (!confirm(`Remove "${pk.name || 'this passkey'}"? You will no longer be able to sign in with it.`)) {
      return;
    }
    try {
      await removePasskey(pk.id);
      await load();
    } catch {
      setError('Failed to remove passkey');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Fingerprint size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Passkeys</h3>
            <p className="text-xs text-gray-500">
              Sign in securely with your fingerprint, face or device PIN
            </p>
          </div>
        </div>
        {supported && (
          <Button size="sm" onClick={handleEnroll} loading={enrolling}>
            <Plus size={14} className="mr-1.5" /> Add Passkey
          </Button>
        )}
      </div>

      <BiometricSecurityNotice />

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {!supported ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 text-center text-gray-400">
          <Lock size={28} className="mb-2 opacity-50" />
          <p className="text-sm">This browser does not support passkeys.</p>
        </div>
      ) : loading ? (
        <div className="flex h-24 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : passkeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 text-center text-gray-400">
          <KeyRound size={28} className="mb-2 opacity-50" />
          <p className="text-sm">No passkeys yet. Add one for faster, safer sign-in.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {passkeys.map((pk) => (
            <li key={pk.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                {pk.deviceType === 'multiDevice' ? (
                  <RefreshCw size={16} />
                ) : (
                  <Smartphone size={16} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {editingId === pk.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(pk.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="h-8 w-full max-w-xs rounded-lg border border-gray-200 px-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                    <button
                      onClick={() => saveRename(pk.id)}
                      className="rounded-lg p-1.5 text-green-600 hover:bg-green-50"
                      title="Save"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                      title="Cancel"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-gray-800">
                      {pk.name || 'Unnamed passkey'}
                      {pk.backedUp && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          <ShieldCheck size={9} /> Synced
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      Added {formatDate(pk.createdAt)}
                      {pk.lastUsedAt
                        ? ` · Last used ${formatRelativeTime(pk.lastUsedAt)}`
                        : ' · Never used'}
                    </p>
                  </>
                )}
              </div>
              {editingId !== pk.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => startRename(pk)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Rename"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleRemove(pk)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
