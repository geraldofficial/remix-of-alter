/**
 * One tiny message channel for the whole app. Works outside React too, so
 * background work (offline sync, uploads) can speak without a toast library.
 */
export type NoticeTone = "ok" | "error";

export type NoticeAction = { label: string; run: () => void };

export type Notice = {
  id: number;
  tone: NoticeTone;
  text: string;
  action?: NoticeAction;
};

type Listener = (current: Notice | undefined) => void;

const listeners = new Set<Listener>();
let current: Notice | undefined;
let seq = 0;

const publish = () => {
  for (const listen of listeners) listen(current);
};

const show = (tone: NoticeTone, text: string, action?: NoticeAction) => {
  current = { id: ++seq, tone, text, ...(action ? { action } : {}) };
  publish();
};

export const notice = {
  ok: (text: string, action?: NoticeAction) => show("ok", text, action),
  error: (text: string, action?: NoticeAction) => show("error", text, action),
  /** message from a thrown value, with a readable fallback */
  from: (err: unknown, fallback: string) =>
    show("error", err instanceof Error && err.message ? err.message : fallback),
  clear: (id?: number) => {
    if (id !== undefined && current?.id !== id) return;
    current = undefined;
    publish();
  },
  get: () => current,
  subscribe: (listen: Listener) => {
    listeners.add(listen);
    return () => listeners.delete(listen);
  },
};
