import type { NewSale } from "@/lib/queries";

const KEY = "sale-queue-v1";

export type QueuedSale = { id: string; at: number; items: NewSale[] };

const read = (): QueuedSale[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedSale[];
  } catch {
    return [];
  }
};

const write = (rows: QueuedSale[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* ignore quota errors */
  }
};

export const queuedSales = read;
export const queuedCount = () => read().length;

export function enqueueSale(items: NewSale[]) {
  const row: QueuedSale = { id: crypto.randomUUID(), at: Date.now(), items };
  write([...read(), row]);
  notify();
  return row;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function onQueueChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** true when the failure looks like "no connection" rather than a real rejection */
export const looksOffline = (err: unknown) => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed");
};

/** Sends everything still waiting; keeps rows that fail again. */
export async function flushQueue(send: (items: NewSale[]) => Promise<unknown>) {
  const rows = read();
  if (!rows.length) return 0;
  const left: QueuedSale[] = [];
  let sent = 0;
  for (const row of rows) {
    try {
      await send(row.items);
      sent += 1;
    } catch (err) {
      if (looksOffline(err)) left.push(row);
      // a real rejection (bad data) is dropped so the queue never jams
    }
  }
  write(left);
  notify();
  return sent;
}
