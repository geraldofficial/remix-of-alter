import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Guard } from "@/components/guard";
import {
  Divider,
  Empty,
  PrimaryButton,
  RowsSkeleton,
  Screen,
  StickyBar,
  TopBar,
} from "@/components/kit";
import { Media } from "@/components/media";
import { SaleFlow } from "@/components/sale-flow";
import { money } from "@/lib/format";
import { useCategories, useProduct } from "@/lib/queries";

export const Route = createFileRoute("/products/$id")({
  head: () => ({
    meta: [
      { title: "Product Details — Stock & Price" },
      {
        name: "description",
        content: "Check stock, pricing and variants for this product, then record a sale straight from the item page.",
      },
      { property: "og:title", content: "Product Details — Stock & Price" },
      {
        property: "og:description",
        content: "Check stock, pricing and variants for this product, then record a sale straight from the item page.",
      },
    ],
  }),
  component: () => (
    <Guard>
      <ProductPage />
    </Guard>
  ),
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data: product, isLoading } = useProduct(id);
  const { data: categories = [] } = useCategories();
  const [selling, setSelling] = useState(false);

  if (isLoading)
    return (
      <Screen>
        <TopBar back title="item" />
        <RowsSkeleton />
      </Screen>
    );
  if (!product)
    return (
      <Screen>
        <TopBar back title="item" />
        <Empty text="this item is gone." />
      </Screen>
    );


  const category = categories.find((c) => c.id === product.category_id)?.name;
  const media = [...(product.product_media ?? [])].sort((a, b) => a.position - b.position);

  return (
    <Screen>
      <TopBar back title={product.name.toLowerCase()} />

      <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {media.length ? (
          media.map((m) => (
            <div
              key={m.id}
              className="w-[86%] shrink-0 snap-center overflow-hidden rounded-lg bg-secondary"
            >
              <Media
                path={m.url}
                kind={m.kind}
                alt={product.name}
                className="h-auto w-full object-contain"
              />
            </div>
          ))
        ) : (
          <div className="w-full">
            <Media path={undefined} alt={product.name} className="rounded-lg" />
          </div>
        )}
      </div>

      <div className="px-4 py-5">
        <p className="text-2xl font-semibold tracking-tight">{money(product.base_price)}</p>
        <p className="mt-1 text-sm text-muted-foreground">base price</p>
      </div>
      <Divider />

      <div className="flex items-center px-4 py-3.5">
        <span className="flex-1 text-sm text-muted-foreground">in stock</span>
        <span className="text-[15px]">{product.stock}</span>
      </div>
      <Divider />

      {category ? (
        <>
          <div className="flex items-center px-4 py-3.5">
            <span className="flex-1 text-sm text-muted-foreground">category</span>
            <span className="text-[15px]">{category.toLowerCase()}</span>
          </div>
          <Divider />
        </>
      ) : null}

      {product.variants?.length ? (
        <>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex-1 text-sm text-muted-foreground">variants</span>
            <span className="text-right text-[15px]">{product.variants.join(", ")}</span>
          </div>
          <Divider />
        </>
      ) : null}

      {product.notes ? (
        <>
          <p className="px-4 py-4 text-sm text-muted-foreground">{product.notes}</p>
          <Divider />
        </>
      ) : null}

      <div className="h-16" />
      <StickyBar>
        <PrimaryButton disabled={product.stock <= 0} onClick={() => setSelling(true)}>
          {product.stock > 0 ? "sell" : "out of stock"}
        </PrimaryButton>
      </StickyBar>

      <Drawer open={selling} onOpenChange={setSelling}>
        <DrawerContent className="border-0">
          <DrawerTitle className="sr-only">sell {product.name}</DrawerTitle>
          <SaleFlow products={[product]} onCancel={() => setSelling(false)} />
        </DrawerContent>
      </Drawer>
    </Screen>
  );
}
