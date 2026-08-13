/**
 * A small on-device photo album, the way chat apps do it: once a picture has
 * been seen it is kept in the phone's own storage, so it opens instantly and
 * keeps working with no connection. Oldest pictures are dropped when the album
 * grows past its size limit.
 */

const DB_NAME = "shop-media";
const STORE = "blobs";
const MAX_BYTES = 160 * 1024 * 1024;

type Entry = { path: string; blob: Blob; bytes: number; used: number };

let dbPromise: Promise<IDBDatabase | null> | undefined;

const openDb = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "path" });
        store.createIndex("used", "used");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
};

const tx = async (mode: IDBTransactionMode) => {
  const db = await openDb();
  if (!db) return null;
  return db.transaction(STORE, mode).objectStore(STORE);
};

const wrap = <T>(request: IDBRequest<T>) =>
  new Promise<T | undefined>((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });

/** live object urls, one per picture, so the same photo is never decoded twice */
const urls = new Map<string, string>();

export const cachedUrl = (path: string) => urls.get(path);

const remember = (path: string, blob: Blob) => {
  const existing = urls.get(path);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  urls.set(path, url);
  return url;
};

async function prune() {
  const store = await tx("readwrite");
  if (!store) return;
  const all = ((await wrap(store.getAll())) ?? []) as Entry[];
  let total = all.reduce((sum, e) => sum + e.bytes, 0);
  if (total <= MAX_BYTES) return;
  for (const entry of all.sort((a, b) => a.used - b.used)) {
    if (total <= MAX_BYTES) break;
    store.delete(entry.path);
    total -= entry.bytes;
    const url = urls.get(entry.path);
    if (url) {
      URL.revokeObjectURL(url);
      urls.delete(entry.path);
    }
  }
}

/** Reads a picture from the phone, and notes that it was just used. */
export async function readCached(path: string): Promise<string | undefined> {
  const held = urls.get(path);
  if (held) return held;
  const store = await tx("readwrite");
  if (!store) return undefined;
  const entry = (await wrap(store.get(path))) as Entry | undefined;
  if (!entry?.blob) return undefined;
  store.put({ ...entry, used: Date.now() });
  return remember(path, entry.blob);
}

/** Keeps a freshly downloaded picture on the phone for next time. */
export async function writeCached(path: string, blob: Blob): Promise<string> {
  const url = remember(path, blob);
  const store = await tx("readwrite");
  if (store) {
    store.put({ path, blob, bytes: blob.size, used: Date.now() } satisfies Entry);
    void prune();
  }
  return url;
}

export async function forgetCached(paths: string[]) {
  const store = await tx("readwrite");
  for (const path of paths) {
    store?.delete(path);
    const url = urls.get(path);
    if (url) {
      URL.revokeObjectURL(url);
      urls.delete(path);
    }
  }
}

export async function clearCached() {
  const store = await tx("readwrite");
  store?.clear();
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}
