import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";


/** Action icons: no background, no border, big and distinct. */
export function IconAction({
  icon: Icon,
  size = 32,
  label,
  className,
  ...props
}: { icon: LucideIcon; size?: number; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn("press bg-transparent p-0 text-foreground outline-none", className)}
      {...props}
    >
      <Icon size={size} strokeWidth={1.6} />
    </button>
  );
}

export function IconLink({
  icon: Icon,
  size = 32,
  label,
  to,
  className,
}: {
  icon: LucideIcon;
  size?: number;
  label: string;
  to: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={cn("press bg-transparent p-0 text-foreground", className)}
    >
      <Icon size={size} strokeWidth={1.6} />
    </Link>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-dvh bg-background pb-[env(safe-area-inset-bottom)]", className)}>
      {children}
    </div>
  );
}

export function TopBar({
  title,
  srTitle,
  right,
  back,
  backTo,
}: {
  title?: string;
  /** extra words added to the page heading for readers and search engines only */
  srTitle?: string;
  right?: ReactNode;
  back?: boolean;
  /** where the chevron goes instead of stepping back through history */
  backTo?: string;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4">
        {backTo ? (
          <IconLink icon={ChevronLeft} size={28} label="go back" to={backTo} />
        ) : back ? (
          <IconAction
            icon={ChevronLeft}
            size={28}
            label="go back"
            onClick={() => router.history.back()}
          />
        ) : null}
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight">
          {title}
          {srTitle ? <span className="sr-only"> — {srTitle}</span> : null}
        </h1>

        {right}
      </div>
    </header>

  );
}

export function Row({
  children,
  onClick,
  onContextMenu,
  className,
  as = "div",
}: {
  children: ReactNode;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
  as?: "div" | "button";
}) {
  const Tag = as === "button" ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "press flex w-full items-center gap-3 border-b border-border/60 px-4 py-3.5 text-left last:border-b-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="px-4 py-16 text-center text-sm text-muted-foreground">{text}</p>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block px-4 py-3">
      <span className="mb-2 block text-xs text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg bg-secondary px-3.5 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring";

/** A bordered group whose children are separated by their own dividers. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        // links wrapping rows must be blocks or their separator line has no width
        "divide-y divide-border/60 overflow-hidden rounded-md border border-border [&>*]:block [&_.press]:border-b-0",
        className,
      )}
    >
      {children}
    </div>
  );
}


/** Flat tabs: no rounding, the active one is underlined in white. */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1", className)}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={cn(
            "press flex-1 rounded-none border-0 border-b-2 px-3 py-2 text-sm",
            option === value
              ? "border-foreground bg-secondary text-foreground"
              : "border-transparent text-muted-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** Four separate digit cells backed by one hidden field. */
export function PinInput({
  value,
  onChange,
  length = 4,
  autoFocus,
  reveal = false,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  autoFocus?: boolean;
  /** show the digits instead of dots — used when picking a new pin */
  reveal?: boolean;
}) {
  return (
    <label className="relative block">
      <input
        autoFocus={autoFocus}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={`${length} digit pin`}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <div className="pointer-events-none flex gap-2.5">
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex h-14 flex-1 items-center justify-center rounded-md border text-2xl",
              i === value.length ? "border-foreground" : "border-border",
            )}
          >
            {value[i] ? (reveal ? value[i] : "•") : ""}
          </span>
        ))}
      </div>
    </label>
  );
}


export function DangerButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={cn(
        "press w-full rounded-lg bg-transparent px-4 py-3.5 text-[15px] font-semibold text-destructive disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}


export function PrimaryButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "press flex min-h-12 w-full items-center justify-center whitespace-nowrap rounded-lg bg-primary px-4 py-3.5 text-center text-[15px] font-semibold text-primary-foreground disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "press flex min-h-12 w-full items-center justify-center whitespace-nowrap rounded-lg bg-secondary px-4 py-3.5 text-center text-[15px] text-foreground disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function StickyBar({ children }: { children: ReactNode }) {
  // rides up with the on-screen keyboard so the buttons stay reachable
  const inset = useKeyboardInset();
  return (
    <div
      className={cn(
        "sticky bottom-0 z-40 shrink-0 border-t border-border/60 bg-background/95 pt-3 backdrop-blur",
        inset ? "px-4 pb-3" : "px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]",
      )}
      style={
        inset ? { transform: `translateY(-${inset}px)`, marginBottom: `-${inset}px` } : undefined
      }
    >
      {children}
    </div>
  );
}

/** Three dots that fill in one after another while something loads. */
export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)} role="status" aria-label="loading">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 animate-[dot_1.2s_ease-in-out_infinite] rounded-full bg-muted-foreground"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}


/** Quiet grey stand-in used while real content is on its way. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-secondary", className)} />;
}

/** A list that has not arrived yet, in the shape of the real one. */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="mt-2 h-2.5 w-1/4" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

/** A photo grid that has not arrived yet. */
export function GridSkeleton({ tiles = 6 }: { tiles?: number }) {
  const heights = ["h-40", "h-56", "h-48", "h-64", "h-44", "h-52"];
  return (
    <div className="columns-2 gap-1 px-1" aria-hidden>
      {Array.from({ length: tiles }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("mb-1 w-full break-inside-avoid", heights[i % heights.length])}
        />
      ))}
    </div>
  );
}
