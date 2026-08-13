import { supabase } from "@/integrations/supabase/client";
import { forgetCached, readCached, writeCached } from "@/lib/image-cache";

const BUCKET = "product-media";
const STORE_KEY = "media-urls-v1";
const TTL_DAYS = 7;

type Entry = { url: string; exp: number };
type Store = Record<string, Entry>;

const read = (): Store => {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
};

const write = (store: Store) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage full — signed urls will simply be re-fetched */
  }
};

/** small preview twin of an uploaded image, used by grids so they load instantly */
export const thumbPathOf = (path: string) =>
  path.endsWith(".webp") ? path.replace(/\.webp$/, "_t.webp") : path;

/**
 * Resolves storage paths to signed urls and keeps them on the phone for a week,
 * so images stay stable (and cacheable by the service worker) between sessions.
 */
export async function resolveMedia(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const store = read();
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];

  for (const p of unique) {
    const hit = store[p];
    if (hit && hit.exp > now) out[p] = hit.url;
    else missing.push(p);
  }

  if (missing.length) {
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(missing, 60 * 60 * 24 * TTL_DAYS);
    for (const row of data ?? []) {
      if (!row.signedUrl || !row.path) continue;
      out[row.path] = row.signedUrl;
      store[row.path] = { url: row.signedUrl, exp: now + TTL_DAYS * 86400000 - 3600000 };
    }
    write(store);
  }
  return out;
}

/** Shrinks a photo in the browser so uploads are quick and images load fast. */
async function shrink(file: File, maxSide: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("could not process the image");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
  if (!blob) throw new Error("could not process the image");
  return blob;
}

export type Prepared = {
  path: string;
  kind: "image" | "video";
  blob: Blob;
  thumb?: Blob;
};

/**
 * Gets a picked file ready: shrinks it, makes a small twin and settles on the
 * name it will keep. Nothing is sent yet, so this never waits on the network.
 */
export async function prepareMedia(file: File): Promise<Prepared> {
  const id = crypto.randomUUID();

  if (file.type.startsWith("video")) {
    const ext = file.name.split(".").pop() ?? "mp4";
    return { path: `${id}.${ext}`, kind: "video", blob: file };
  }

  let full: Blob = file;
  let thumb: Blob | undefined;
  try {
    full = await shrink(file, 1400, 0.78);
    thumb = await shrink(file, 420, 0.7);
  } catch {
    /* fall back to the original file if the browser cannot resize it */
  }
  return { path: `${id}.webp`, kind: "image", blob: full, ...(thumb ? { thumb } : {}) };
}

/** Sends a prepared photo to the shop's store. Safe to call again after a failure. */
export async function putMedia({ path, kind, blob, thumb }: Prepared): Promise<void> {
  const contentType = kind === "video" ? blob.type || "video/mp4" : "image/webp";
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType, cacheControl: "31536000" });
  if (error) throw error;

  if (thumb) {
    await supabase.storage
      .from(BUCKET)
      .upload(thumbPathOf(path), thumb, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: "31536000",
      })
      .catch(() => undefined);
  }
}

export const removeMedia = async (paths: string[]) => {
  const all = [...paths, ...paths.map(thumbPathOf)];
  await forgetCached(all);
  return supabase.storage.from(BUCKET).remove(all);
};

/**
 * A picture would not open: forget both the phone's copy and the saved link, so
 * the next attempt fetches a fresh one instead of showing a broken image.
 */
export const forgetBroken = async (paths: string[]) => {
  const store = read();
  for (const path of paths) delete store[path];
  write(store);
  await forgetCached(paths);
};


/**
 * Gives back a picture to show, preferring the phone's own copy. The first time
 * a photo is seen it is downloaded once and kept, so later views are instant
 * and work with no connection.
 */
export async function loadMedia(
  candidates: string[],
  kind: string = "image",
): Promise<string | undefined> {
  const wanted = candidates.filter(Boolean);
  if (!wanted.length) return undefined;

  if (kind !== "video") {
    for (const path of wanted) {
      const held = await readCached(path);
      if (held) return held;
    }
  }

  const signed = await resolveMedia(wanted);
  for (const path of wanted) {
    const url = signed[path];
    if (!url) continue;
    if (kind === "video") return url;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      // a signed link for a missing file answers with a small error page, not a picture
      if (blob.size === 0 || !/^(image|video)\//.test(blob.type)) continue;
      return await writeCached(path, blob);

    } catch {
      return url;
    }
  }
  return undefined;
}

/**
 * Quietly fills the phone's album with the small twins a grid is about to show,
 * a few at a time, so scrolling stays smooth and later visits need no network.
 */
export async function warmMedia(paths: string[], limit = 40) {
  const wanted = Array.from(new Set(paths.filter(Boolean))).slice(0, limit).map(thumbPathOf);
  if (!wanted.length) return;
  const cold: string[] = [];
  for (const path of wanted) {
    const held = await readCached(path);
    if (!held) cold.push(path);
  }
  if (!cold.length) return;
  await resolveMedia(cold);
  for (let i = 0; i < cold.length; i += 4) {
    await Promise.all(cold.slice(i, i + 4).map((p) => loadMedia([p]).catch(() => undefined)));
  }
}
