"use client";

import { useSyncExternalStore } from "react";

/**
 * Billed amounts typed into the billing table but not saved yet, per case. The table cells, the Save changes bar and
 * the Send quote button all read it, so the quote can't go out while an edit is pending.
 */
type Drafts = Record<string, string>;

const EMPTY: Drafts = {};
const store = new Map<string, Drafts>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function setDraft(caseId: string, itemId: string, value: string | null) {
  const next = { ...(store.get(caseId) ?? EMPTY) };
  if (value === null) delete next[itemId];
  else next[itemId] = value;
  if (Object.keys(next).length) store.set(caseId, next);
  else store.delete(caseId);
  emit();
}

export function clearDrafts(caseId: string) {
  if (store.delete(caseId)) emit();
}

export function useDrafts(caseId: string): Drafts {
  return useSyncExternalStore(
    subscribe,
    () => store.get(caseId) ?? EMPTY,
    () => EMPTY,
  );
}
