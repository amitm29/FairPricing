'use client';

import type { LadderKind, TierLadder } from './tier-ladder';

/**
 * Where the fetched ladder lives between sessions. The browser is the right
 * home: this deployment has no database by design and Vercel's filesystem is
 * read-only, and it is the user's own App Store key doing the fetching. A
 * ladder is a few MB, comfortable for IndexedDB and too big for localStorage.
 */
const DB_NAME = 'fairpricing';
const STORE = 'apple-tier-ladders';
const memory = new Map<LadderKind, TierLadder>();

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then((db) => {
    if (!db) return null;
    return new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
      } catch {
        resolve(null);
      }
    });
  });
}

export async function loadLadder(kind: LadderKind): Promise<TierLadder | null> {
  const stored = await withStore<TierLadder>('readonly', (store) => store.get(kind));
  if (stored && stored.kind === kind && stored.territories) return stored;
  return memory.get(kind) ?? null;
}

export async function saveLadder(ladder: TierLadder): Promise<void> {
  memory.set(ladder.kind, ladder);
  await withStore('readwrite', (store) => store.put(ladder, ladder.kind));
}

export async function clearLadder(kind: LadderKind): Promise<void> {
  memory.delete(kind);
  await withStore('readwrite', (store) => store.delete(kind));
}
