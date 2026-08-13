import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { notice } from "@/lib/notice";
import { Guard } from "@/components/guard";
import { Empty, GridSkeleton, IconAction, IconLink, Screen, TopBar } from "@/components/kit";
import { ProductGrid } from "@/components/product-grid";
import { useDeleteProducts, useProducts, type Product } from "@/lib/queries";

export const Route = createFileRoute("/manage/")({
  head: () => ({
    meta: [
      { title: "Stock — Manage Shop Products" },
      { name: "description", content: "Manage your shop inventory by adding, editing or removing products and keeping stock levels up to date." },
      { property: "og:title", content: "Stock — Manage Shop Products" },
      { property: "og:description", content: "Manage your shop inventory by adding, editing or removing products and keeping stock levels up to date." },
    ],
  }),
  component: () => (
    <Guard adminOnly>
      <ManagePage />
    </Guard>
  ),
});

function ManagePage() {
  const navigate = useNavigate();
  const { data: products = [], isLoading } = useProducts();
  const del = useDeleteProducts();
  const [selected, setSelected] = useState<Set<string> | null>(null);

  const toggle = (p: Product) =>
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      return next;
    });

  const remove = async () => {
    if (!selected?.size) return;
    try {
      await del.mutateAsync([...selected]);
      setSelected(null);
      notice.ok("items removed");
    } catch (err) {
      notice.from(err, "could not remove");
    }
  };

  return (
    <Screen>
      <TopBar
        back
        title={selected ? `${selected.size} selected` : "stock"}
        right={
          selected ? (
            <div className="flex items-center gap-4">
              <IconAction
                icon={Trash2}
                size={26}
                label="delete selected"
                className="text-destructive"
                onClick={() => void remove()}
              />

              <IconAction
                icon={X}
                size={26}
                label="clear selection"
                onClick={() => setSelected(null)}
              />
            </div>
          ) : (
            <IconLink
              to="/manage/new"
              icon={Plus}
              label="add a product"
              size={30}
              className="text-info"
            />

          )
        }
      />
      {isLoading ? (
        <GridSkeleton />
      ) : products.length === 0 ? (
        <Empty text="no items yet, tap the plus to add one." />
      ) : (
        <div className="pt-1">
          <ProductGrid
            products={products}
            onOpen={(p) =>
              selected ? toggle(p) : void navigate({ to: "/manage/$id", params: { id: p.id } })
            }
            onLongPress={(p) => setSelected(new Set([p.id]))}
            {...(selected ? { selected } : {})}
          />
        </div>
      )}
      <div className="h-20" />
    </Screen>
  );
}
