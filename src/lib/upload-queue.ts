/**
 * Photos keep uploading on their own. A picked photo is shrunk, given its final
 * name, and kept on the phone straight away — so the item can be saved at once
 * and the picture shows immediately. The bytes then travel in the background
 * and pick up where they left off if the app is closed or the line drops.
 */

import { putMedia, thumbPathOf, type Prepared } from "./media";
import { writeCached } from "./image-cache";

const DB_NAME = "shop-uploads";
const STORE = "pending";

type Job = Prepared & { at: number; tries: number };

let dbPromise: Promise<IDBDatabase | null> | undefined;

const openDb = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "path" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
};

const store = async (mode: IDBTransactionMode) => {
  const db = await openDb();
  return db ? db.transaction(STORE, mode).objectStore(STORE) : null;
};

const wrap = <T>(request: IDBRequest<T>) =>
  new Promise<T | undefined>((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });

const listeners = new Set<() => void>();
let pending = 0;

const announce = (count: number) => {
  pending = count;
  for (const fn of listeners) fn();
};

export const pendingUploads = () => pending;

export function onUploadsChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const count = async () => {
  const s = await store("readonly");
  return s ? ((await wrap(s.count())) ?? 0) : 0;
};

/**
 * Takes a prepared photo, shows it instantly from the phone's own copy and
 * hands the upload to the background worker.
 */
export async function queueUpload(prepared: Prepared) {
  if (prepared.kind === "image") {
    await writeCached(prepared.path, prepared.blob);
    if (prepared.thumb) await writeCached(thumbPathOf(prepared.path), prepared.thumb);
  }
  const s = await store("readwrite");
  s?.put({ ...prepared, at: Date.now(), tries: 0 } satisfies Job);
  announce((await count()) || pending + 1);
  void run();
}

export async function cancelUpload(path: string) {
  const s = await store("readwrite");
  s?.delete(path);
  announce(await count());
}

let running = false;

/** Sends everything still waiting, oldest first, one at a time. */
export async function run(): Promise<void> {
  if (running || typeof navigator === "undefined" || navigator.onLine === false) return;
  running = true;
  try {
    for (;;) {
      const s = await store("readonly");
      if (!s) return;
      const jobs = ((await wrap(s.getAll())) ?? []) as Job[];
      const job = jobs.sort((a, b) => a.at - b.at)[0];
      if (!job) {
        announce(0);
        return;
      }
      try {
        await putMedia(job);
        const done = await store("readwrite");
        done?.delete(job.path);
        announce(Math.max(0, jobs.length - 1));
      } catch {
        const again = await store("readwrite");
        again?.put({ ...job, tries: job.tries + 1 });
        announce(jobs.length);
        return; // the connection is unhappy; try again on the next nudge
      }
    }
  } finally {
    running = false;
  }
}

/** Wakes the uploader on launch, when the line returns and when the app is reopened. */
export function watchUploads() {
  if (typeof window === "undefined") return () => {};
  const nudge = () => void run();
  const onVisible = () => {
    if (document.visibilityState === "visible") nudge();
  };
  void count().then(announce);
  nudge();
  window.addEventListener("online", nudge);
  document.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(nudge, 20000);
  return () => {
    window.removeEventListener("online", nudge);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
  };
}
