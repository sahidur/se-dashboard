'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

/**
 * Per-user, server-side draft store for data-collection forms.
 *
 * Drafts are saved to the backend (`dc_form_drafts` table, scoped by the
 * current user + school + form key) so a draft started on one device is
 * still there when the same user logs in on a different device/browser.
 * They are NEVER sent anywhere else: only the owning user can read/write
 * their own draft, they create no upload/audit logs, and they never appear
 * in real form responses, school dashboards or programme-overview.
 *
 * A localStorage copy is kept purely as a best-effort offline fallback (used
 * only if the initial server fetch fails, e.g. no connectivity) — the server
 * is always the source of truth.
 *
 * A draft only becomes "real" data when the user clicks Submit (which runs
 * the form's normal backend POST and then clears the draft).
 */

interface DraftEnvelope<T> {
  data: T;
  savedAt: string;
}

export interface FormDraft<T> {
  hasDraft: boolean;
  draftSavedAt: string | null;
  /** True while the initial check for an existing (cross-device) draft is in flight. */
  checkingDraft: boolean;
  /** Read the currently stored draft payload (or null if none). */
  loadDraft: () => Promise<T | null>;
  /** Persist the given payload as this form's draft on the server. */
  saveDraft: (data: T) => Promise<void>;
  /** Remove this form's draft from the server. */
  clearDraft: () => Promise<void>;
}

export function useFormDraft<T>(formKey: string, schoolId: string): FormDraft<T> {
  const userId = useAuthStore((s) => s.user?.id) ?? 'anon';

  const storageKey = useMemo(
    () => `dc-draft:${userId}:${schoolId}:${formKey}`,
    [userId, schoolId, formKey],
  );

  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [checkingDraft, setCheckingDraft] = useState(true);
  const cacheRef = useRef<T | null>(null);

  const readLocalFallback = useCallback((): DraftEnvelope<T> | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as DraftEnvelope<T>) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const writeLocalFallback = useCallback(
    (envelope: DraftEnvelope<T> | null) => {
      if (typeof window === 'undefined') return;
      try {
        if (envelope) window.localStorage.setItem(storageKey, JSON.stringify(envelope));
        else window.localStorage.removeItem(storageKey);
      } catch {
        /* storage full / disabled — ignore */
      }
    },
    [storageKey],
  );

  // Check the server for an existing draft whenever the form/school changes,
  // so the "Draft saved" banner reflects drafts saved from ANY device.
  useEffect(() => {
    let cancelled = false;
    if (!schoolId) {
      setCheckingDraft(false);
      return;
    }
    setCheckingDraft(true);
    (async () => {
      try {
        const res = await api.get('/data-collection/drafts', { params: { schoolId, formKey } });
        if (cancelled) return;
        if (res.data) {
          cacheRef.current = res.data.data as T;
          setDraftSavedAt(res.data.updatedAt ?? null);
          writeLocalFallback({ data: res.data.data, savedAt: res.data.updatedAt });
        } else {
          cacheRef.current = null;
          setDraftSavedAt(null);
          writeLocalFallback(null);
        }
      } catch {
        if (cancelled) return;
        // Offline / request failed — fall back to whatever was last cached
        // locally so in-progress work isn't lost, rather than hiding it.
        const local = readLocalFallback();
        if (local) {
          cacheRef.current = local.data;
          setDraftSavedAt(local.savedAt ?? null);
        }
      } finally {
        if (!cancelled) setCheckingDraft(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, formKey]);

  const loadDraft = useCallback(async (): Promise<T | null> => {
    if (cacheRef.current !== null) return cacheRef.current;
    if (!schoolId) return null;
    try {
      const res = await api.get('/data-collection/drafts', { params: { schoolId, formKey } });
      if (res.data) {
        cacheRef.current = res.data.data as T;
        setDraftSavedAt(res.data.updatedAt ?? null);
        return cacheRef.current;
      }
      return null;
    } catch {
      const local = readLocalFallback();
      return local ? local.data : null;
    }
  }, [schoolId, formKey, readLocalFallback]);

  const saveDraft = useCallback(
    async (data: T) => {
      if (!schoolId) throw new Error('Missing school context for draft save.');
      await api.post('/data-collection/drafts', { schoolId, formKey, data });
      const savedAt = new Date().toISOString();
      cacheRef.current = data;
      setDraftSavedAt(savedAt);
      writeLocalFallback({ data, savedAt });
    },
    [schoolId, formKey, writeLocalFallback],
  );

  const clearDraft = useCallback(async () => {
    if (schoolId) {
      await api.delete('/data-collection/drafts', { params: { schoolId, formKey } });
    }
    cacheRef.current = null;
    setDraftSavedAt(null);
    writeLocalFallback(null);
  }, [schoolId, formKey, writeLocalFallback]);

  return {
    hasDraft: draftSavedAt !== null,
    draftSavedAt,
    checkingDraft,
    loadDraft,
    saveDraft,
    clearDraft,
  };
}
