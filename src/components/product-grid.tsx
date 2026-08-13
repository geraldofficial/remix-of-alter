import { Check } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Media } from "@/components/media";
import type { Product } from "@/lib/queries";

/**
 * Google photos style justified masonry: every image keeps the shape it was
 * taken in, fills its column edge to edge and is never cropped.
 */
export function ProductGrid({
  products,
  onOpen,
  onLongPress,
  selected,
  leading,
  why,
}: {
  products: Product[];
  onOpen: (p: Product) => void;
  onLongPress?: (p: Product) => void;
  selected?: Set<string>;
  leading?: ReactNode;
  /** short explanation of why an item showed up in a search */
  why?: Record<string, string>;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);

  const start = (p: Product) => {
    longPressed.current = false;
    if (!onLongPress) return;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      navigator.vibrate?.(12);
      onLongPress(p);
    }, 420);
  };
  const end = () => clearTimeout(timer.current);

  return (
    <div className="columns-2 gap-1 px-1 [column-fill:_balance]">
      {leading ? <div className="mb-1 break-inside-avoid">{leading}</div> : null}
      {products.map((p, i) => {
        const isSelected = selected?.has(p.id);
        const cover = (p.product_media ?? []).reduce<Product["product_media"][number] | undefined>(
          (best, m) => (!best || m.position < best.position ? m : best),
          undefined,
        );
        return (
          <button
            key={p.id}
            onPointerDown={() => start(p)}
            onPointerUp={end}
            onPointerLeave={end}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              if (longPressed.current) {
                longPressed.current = false;
                return;
              }
              onOpen(p);
            }}
            className="press relative mb-1 block w-full break-inside-avoid overflow-hidden rounded-lg bg-secondary [content-visibility:auto]"
          >
            <Media
              path={cover?.url}
              alt={p.name}
              thumb
              priority={i < 4}
              className="h-auto w-full object-contain"
            />

            {selected ? (
              <span
                className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/70 text-transparent"
                }`}
              >
                <Check size={15} strokeWidth={2.4} />
              </span>
            ) : null}
            {p.stock <= 0 ? (
              <span className="absolute bottom-2 left-2 rounded-lg bg-background/80 px-2 py-1 text-xs text-muted-foreground">
                out of stock
              </span>
            ) : null}
            {why?.[p.id] ? (
              <span className="block px-2 py-1.5 text-left text-xs text-muted-foreground">
                {why[p.id]}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
