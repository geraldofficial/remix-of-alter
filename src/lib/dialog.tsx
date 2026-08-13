/**
 * In-app replacements for window.confirm / window.prompt.
 * As bare as the browser ones: a line of text, one input line, one action.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type AskRequest = {
  id: number;
  kind: "confirm" | "text";
  text: string;
  placeholder?: string;
  value?: string;
  action: string;
  danger?: boolean;
  resolve: (value: string | null) => void;
};

type Listener = (current: AskRequest | undefined) => void;

const listeners = new Set<Listener>();
let current: AskRequest | undefined;
let seq = 0;

const publish = () => {
  for (const listen of listeners) listen(current);
};

const push = (req: Omit<AskRequest, "id" | "resolve">) =>
  new Promise<string | null>((resolve) => {
    current = { ...req, id: ++seq, resolve };
    publish();
  });

/** yes / no question. resolves true when confirmed. */
export const askConfirm = async (
  text: string,
  opts?: { action?: string; danger?: boolean },
): Promise<boolean> =>
  (await push({
    kind: "confirm",
    text,
    action: opts?.action ?? "confirm",
    ...(opts?.danger ? { danger: true } : {}),
  })) !== null;

/** one line of text. resolves null when dismissed. */
export const askText = (
  text: string,
  opts?: { placeholder?: string; value?: string; action?: string },
) =>
  push({
    kind: "text",
    text,
    action: opts?.action ?? "save",
    ...(opts?.placeholder ? { placeholder: opts.placeholder } : {}),
    ...(opts?.value ? { value: opts.value } : {}),
  });

const subscribe = (listen: Listener) => {
  listeners.add(listen);
  return () => listeners.delete(listen);
};

const close = (req: AskRequest, value: string | null) => {
  req.resolve(value);
  if (current?.id === req.id) {
    current = undefined;
    publish();
  }
};

export function DialogHost() {
  const [req, setReq] = useState<AskRequest | undefined>(current);
  const [value, setValue] = useState("");
  // space taken by the on-screen keyboard, measured live
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const off = subscribe((next) => {
      setReq(next);
      setValue(next?.value ?? "");
    });
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
    if (!vv) return;
    const measure = () =>
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    return () => {
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
    };
  }, []);

  if (!req) return null;

  const done = () => close(req, req.kind === "text" ? value.trim() || null : "");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 backdrop-blur"
      onClick={() => close(req, null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: inset ? inset + 20 : undefined }}
        className="mx-auto w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-6 transition-[padding] duration-150"
      >
        <p className="text-[15px]">{req.text}</p>

        {req.kind === "text" ? (
          <input
            autoFocus
            value={value}
            placeholder={req.placeholder ?? ""}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") done();
              if (e.key === "Escape") close(req, null);
            }}
            className="mt-4 w-full border-0 border-b border-border bg-transparent pb-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-6">
          <button
            onClick={() => close(req, null)}
            className="press bg-transparent text-[15px] text-muted-foreground"
          >
            cancel
          </button>
          <button
            onClick={done}
            className={cn(
              "press bg-transparent text-[15px] font-semibold",
              req.danger ? "text-destructive" : "text-foreground",
            )}
          >
            {req.action}
          </button>
        </div>
      </div>
    </div>
  );
}
