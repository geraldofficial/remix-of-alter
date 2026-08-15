import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, X, LayoutGrid } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Guard } from "@/components/guard";
import {
  Divider,
  Empty,
  GridSkeleton,
  IconAction,
  PrimaryButton,
  Screen,
  TopBar,
} from "@/components/kit";
import { ProductGrid } from "@/components/product-grid";
import { SaleFlow } from "@/components/sale-flow";
import { warmMedia } from "@/lib/media";
import { useCategories, useProducts, type Product } from "@/lib/queries";
import { useProductSearch } from "@/lib/use-search";

/** how many items are rendered at a time as you scroll */
const PAGE = 60;

export const Route = createFileRoute("/products/")({
  head: () => ({
    meta: [
      { title: "products" },
      { name: "description", content: "browse every item in the shop and sell it in a few taps." },
      { property: "og:title", content: "products" },
      {
        property: "og:description",
        content: "browse every item in the shop and sell it in a few taps.",
      },
    ],
  }),
  component: () => (
    <Guard>
      <ProductsPage />
    </Guard>
  ),
});

function ProductsPage() {
  const navigate = useNavigate();
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const { query, setQuery, results, suggestions, aiPending, usedAi, usedCache } = useProductSearch(
    products,
    categories,
  );
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [selling, setSelling] = useState<Product[] | null>(null);
  const [focused, setFocused] = useState(false);
  /** the grid grows as you scroll, so a shop with thousands of items still opens at once */
  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const chips = Array.from(
    new Set([...categories.map((c) => c.name), ...products.slice(0, 12).map((p) => p.name)]),
  ).slice(0, 14);

  useEffect(() => setShown(PAGE), [query, products.length]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setShown((n) => n + PAGE),
      { rootMargin: "600px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [isLoading]);

  // the pictures the grid is about to show are kept on the phone, so it stays smooth
  useEffect(() => {
    if (!products.length) return;
    const covers = products
      .slice(0, shown + PAGE)
      .map((p) => (p.product_media ?? []).find((m) => m.kind !== "video")?.url)
      .filter((u): u is string => !!u);
    const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 300));
    idle(() => void warmMedia(covers));
  }, [products, shown]);


  const toggle = (p: Product) => {
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      return next;
    });
  };

  const open = (p: Product) => {
    if (selected) return toggle(p);
    void navigate({ to: "/products/$id", params: { id: p.id } });
  };

  const chosen = products.filter((p) => selected?.has(p.id));
  const found = results.map((r) => r.product);
  const why = Object.fromEntries(
    results.filter((r) => r.why && query).map((r) => [r.product.id, r.why!]),
  );

  return (
    <Screen>
      <TopBar
        back
        title={selected ? `${selected.size} selected` : "products"}
        right={
          selected ? (
            <IconAction
              icon={X}
              size={26}
              label="clear selection"
              onClick={() => setSelected(null)}
            />
          ) : undefined
        }
      />

      {!selected ? (
        <>
          <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => setQuery(c)}
                className="press shrink-0 rounded-full bg-secondary px-3.5 py-2 text-sm text-foreground"
              >
                {c.toLowerCase()}
              </button>
            ))}
          </div>
          <Divider />
        </>
      ) : null}

      {query && (usedAi || usedCache || aiPending) ? (
        <p className="px-4 pt-3 text-xs text-muted-foreground">
          {aiPending
            ? "reading the shop…"
            : usedCache
              ? "remembered from an earlier search"
              : "matched by meaning"}
        </p>
      ) : null}

      <div className="pt-1">
        {isLoading ? (
          <GridSkeleton />
        ) : found.length === 0 ? (
          <div>
            <Empty text={aiPending ? "looking through the shop…" : "nothing matches that."} />
            {!aiPending && suggestions.length ? (
              <div className="px-4">
                <p className="mb-2 text-xs text-muted-foreground">try one of these instead</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.slice(0, 6).map((s) => (
                    <button
                      key={s}
                      onClick={() => setQuery(s)}
                      className="press rounded-full bg-secondary px-3.5 py-2 text-sm text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <ProductGrid
            products={found.slice(0, shown)}
            why={why}
            onOpen={open}
            onLongPress={(p) => setSelected(new Set([p.id]))}
            {...(selected ? { selected } : {})}
            leading={
              !query ? (
                <button
                  onClick={() => void navigate({ to: "/categories" })}
                  className="press flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg bg-secondary"
                >
                  <LayoutGrid size={30} strokeWidth={1.5} />
                  <span className="text-sm">categories</span>
                </button>
              ) : null
            }
          />
        )}
      </div>

      <div className="h-28" />

      {selected && selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur">
          <Divider className="mb-3" />
          <PrimaryButton onClick={() => setSelling(chosen)}>
            sell {selected.size} items
          </PrimaryButton>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          {focused && suggestions.length ? (
            <div className="mb-2 overflow-hidden rounded-lg bg-secondary">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setQuery(s)}
                  className="press block w-full px-4 py-3 text-left text-sm text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-3 shadow-none">
            <Search size={18} className="shrink-0 text-muted-foreground" />
            <input
              value={query}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 120)}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search or describe an item"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <IconAction icon={X} size={18} label="clear" onClick={() => setQuery("")} />
            ) : null}
          </div>
        </div>
      )}

      <Drawer open={!!selling} onOpenChange={(o) => !o && setSelling(null)}>
        <DrawerContent className="border-0">
          <DrawerTitle className="sr-only">sell items</DrawerTitle>
          {selling ? (
            <SaleFlow
              products={selling}
              onCancel={() => {
                setSelling(null);
                setSelected(null);
              }}
            />
          ) : null}
        </DrawerContent>
      </Drawer>
    </Screen>
  );
}
