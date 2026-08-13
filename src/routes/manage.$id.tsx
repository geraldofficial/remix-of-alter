import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { notice } from "@/lib/notice";
import { askConfirm } from "@/lib/dialog";

import { Guard } from "@/components/guard";
import { Divider, Empty, Row, RowsSkeleton, Screen, TopBar } from "@/components/kit";
import { ProductForm } from "@/components/product-form";
import { useDeleteProducts, useProduct } from "@/lib/queries";

export const Route = createFileRoute("/manage/$id")({
  head: () => ({
    meta: [
      { title: "edit item" },
      { name: "description", content: "edit the price, stock, photos and details of an item." },
      { property: "og:title", content: "edit item" },
      {
        property: "og:description",
        content: "edit the price, stock, photos and details of an item.",
      },
    ],
  }),
  component: () => (
    <Guard adminOnly>
      <EditProduct />
    </Guard>
  ),
});

function EditProduct() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id);
  const del = useDeleteProducts();

  if (isLoading) return <RowsSkeleton />;
  if (!product) return <Empty text="this item is gone." />;

  const remove = async () => {
    if (!(await askConfirm("delete this item?", { action: "delete", danger: true }))) return;
    await del.mutateAsync([product.id]);
    notice.ok("item deleted");
    await navigate({ to: "/manage" });
  };

  return (
    <Screen>
      <TopBar back title={product.name.toLowerCase()} />
      <ProductForm product={product} onDone={() => void navigate({ to: "/manage" })} />
      <Divider />
      <Row as="button" onClick={() => void remove()}>
        <span className="flex-1 text-[15px] text-destructive">delete this item</span>
      </Row>
    </Screen>
  );
}
