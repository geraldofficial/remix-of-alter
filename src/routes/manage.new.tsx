import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Guard } from "@/components/guard";
import { Screen, TopBar } from "@/components/kit";
import { ProductForm } from "@/components/product-form";

export const Route = createFileRoute("/manage/new")({
  head: () => ({
    meta: [
      { title: "add an item" },
      { name: "description", content: "add a new item to the shop step by step." },
      { property: "og:title", content: "add an item" },
      { property: "og:description", content: "add a new item to the shop step by step." },
    ],
  }),
  component: () => (
    <Guard adminOnly>
      <NewProduct />
    </Guard>
  ),
});

function NewProduct() {
  const navigate = useNavigate();
  return (
    <Screen>
      <TopBar backTo="/" title="add an item" />
      <ProductForm onDone={() => void navigate({ to: "/manage" })} />
    </Screen>
  );
}
