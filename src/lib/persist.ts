import { type QueryClient, dehydrate, hydrate } from "@tanstack/react-query";

const DB_NAME = "shop-cache";
const STORE = "state";
const KEY = "query-cache-v2";
const LEGACY_KEY = "query-cache-v1";
const MAX_AGE = 1000 * 60 * 60 * 24 * 14;

type Saved = { at: number; state: unknown };

let dbPromise: Promise<IDBDatabase | null> | undefined;

const openDb = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
};

const get = async (): Promise<Saved | undefined> => {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result as Saved | undefined);
    request.onerror = () => resolve(undefined);
  });
};

const put = async (value: Saved) => {
  const db = await openDb();
  db?.transaction(STORE, "readwrite").objectStore(STORE).put(value, KEY);
};

const idle = (fn: () => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn);
  else setTimeout(fn, 0);
};

/**
 * Keeps fetched products, prices and sales on the phone between sessions, so the
 * app opens with content already there. Saving waits for a quiet moment, so
 * scrolling and typing never stutter because of it.
 */
export function attachPersistence(client: QueryClient) {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(LEGACY_KEY); // the old, slower home for this cache
  } catch {
    /* ignore */
  }

  void get().then((saved) => {
    if (saved && Date.now() - saved.at < MAX_AGE) {
      try {
        hydrate(client, saved.state);
      } catch {
        /* a cache saved in an older shape is simply ignored */
      }
    }
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  client.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      idle(() => {
        // only finished, healthy results are worth keeping for the next visit
        void put({
          at: Date.now(),
          state: dehydrate(client, {
            shouldDehydrateQuery: (q) => q.state.status === "success" && !q.isStaleByTime(MAX_AGE),
          }),
        });
      });
    }, 2000);
  });

}

export const clearPersistence = () => {
  void openDb().then((db) => {
    db?.transaction(STORE, "readwrite").objectStore(STORE).delete(KEY);
  });
};
