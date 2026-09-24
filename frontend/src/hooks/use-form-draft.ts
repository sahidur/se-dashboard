'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
 * Draft payloads are not stored in browser storage: they can contain sensitive
 * school and student data and must not survive sign-out on a shared device.
 *
 * A draft only becomes "real" data when the user clicks Submit (which runs
 * the form's normal backend POST and then clears the draft).
 */

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
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [checkingDraft, setCheckingDraft] = useState(true);
  const cacheRef = useRef<T | null>(null);
  // `cacheRef` alone can't tell "no draft exists" apart from "not fetched yet",
  // so every loadDraft() used to re-request. These track that separately and
  // let concurrent callers share one in-flight request.
  const fetchedRef = useRef(false);
  const inFlightRef = useRef<Promise<T | null> | null>(null);

  /** Single shared fetch — deduped so N callers cause at most one request. */
  const fetchDraft = useCallback((): Promise<T | null> => {
    if (!schoolId) return Promise.resolve(null);
    if (inFlightRef.current) return inFlightRef.current;

    const request = api
      .get('/data-collection/drafts', { params: { schoolId, formKey } })
      .then(({ data }) => {
        if (data) {
          cacheRef.current = data.data as T;
          setDraftSavedAt(data.updatedAt ?? null);
        } else {
          cacheRef.current = null;
          setDraftSavedAt(null);
        }
        fetchedRef.current = true;
        return cacheRef.current;
      })
      .catch(() => {
        // Retain only the in-memory copy if the network is temporarily down.
        return cacheRef.current;
      })
      .finally(() => {
        inFlightRef.current = null;
      });

    inFlightRef.current = request;
    return request;
  }, [schoolId, formKey]);

  // Check the server for an existing draft whenever the form/school changes,
  // so the "Draft saved" banner reflects drafts saved from ANY device.
  // State updates are deferred to a microtask: calling setState synchronously
  // inside an effect body causes cascading renders (react-hooks lint rule)
  // for zero benefit here.
  useEffect(() => {
    let cancelled = false;
    fetchedRef.current = false;
    inFlightRef.current = null;
    cacheRef.current = null;

    Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        if (!schoolId) {
          setCheckingDraft(false);
          return undefined;
        }
        setCheckingDraft(true);
        return fetchDraft().finally(() => {
          if (!cancelled) setCheckingDraft(false);
        });
      })
      .catch(() => {
        // Errors are already handled inside fetchDraft.
      });

    return () => {
      cancelled = true;
    };
  }, [schoolId, formKey, fetchDraft]);

  const loadDraft = useCallback(async (): Promise<T | null> => {
    if (fetchedRef.current) return cacheRef.current;
    return fetchDraft();
  }, [fetchDraft]);

  const saveDraft = useCallback(
    async (data: T) => {
      if (!schoolId) throw new Error('Missing school context for draft save.');
      await api.post('/data-collection/drafts', { schoolId, formKey, data });
      const savedAt = new Date().toISOString();
      cacheRef.current = data;
      fetchedRef.current = true;
      setDraftSavedAt(savedAt);
    },
    [schoolId, formKey],
  );

  const clearDraft = useCallback(async () => {
    if (schoolId) {
      await api.delete('/data-collection/drafts', { params: { schoolId, formKey } });
    }
    cacheRef.current = null;
    fetchedRef.current = true;
    setDraftSavedAt(null);
  }, [schoolId, formKey]);

  return {
    hasDraft: draftSavedAt !== null,
    draftSavedAt,
    checkingDraft,
    loadDraft,
    saveDraft,
    clearDraft,
  };
}
