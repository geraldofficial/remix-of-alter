import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { notice, type Notice } from "@/lib/notice";
import { cn } from "@/lib/utils";

const LIFETIME = { ok: 3500, error: 6000 } as const;

/** A single inline message strip pinned above the bottom of the screen. */
export function NoticeBar() {
  const [current, setCurrent] = useState<Notice | undefined>(notice.get);

  useEffect(() => {
    const off = notice.subscribe(setCurrent);
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const id = current.id;
    const timer = setTimeout(() => notice.clear(id), LIFETIME[current.tone]);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
    >
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg px-4 py-3 text-[15px] shadow-lg",
          current.tone === "error"
            ? "bg-destructive text-destructive-foreground"
            : "bg-secondary text-foreground",
        )}
      >
        <span className="min-w-0 flex-1">{current.text}</span>
        {current.action ? (
          <button
            onClick={() => {
              current.action?.run();
              notice.clear(current.id);
            }}
            className="press shrink-0 font-semibold underline"
          >
            {current.action.label}
          </button>
        ) : null}
        <button
          onClick={() => notice.clear(current.id)}
          aria-label="dismiss message"
          className="press shrink-0 opacity-70"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
