import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Guard } from "@/components/guard";
import { Empty, RowsSkeleton, Screen, TopBar } from "@/components/kit";
import { ProductGrid } from "@/components/product-grid";
import { useCategories, useProducts } from "@/lib/queries";

export const Route = createFileRoute("/categories/$id")({
  head: () => ({
    meta: [
      { title: "Category — Items In This Group" },
      { name: "description", content: "Browse and manage every product assigned to this shop category so your inventory stays organised." },
      { property: "og:title", content: "Category — Items In This Group" },
      { property: "og:description", content: "Browse and manage every product assigned to this shop category so your inventory stays organised." },
    ],
  }),
  component: () => (
    <Guard>
      <CategoryPage />
    </Guard>
  ),
});

function CategoryPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const category = categories.find((c) => c.id === id);
  const items = products.filter((p) => p.category_id === id);

  return (
    <Screen>
      <TopBar back title={category?.name.toLowerCase() ?? "category"} />
      {isLoading ? (
        <RowsSkeleton />
      ) : items.length === 0 ? (
        <Empty text="nothing in here yet." />
      ) : (
        <div className="pt-1">
          <ProductGrid
            products={items}
            onOpen={(p) => void navigate({ to: "/products/$id", params: { id: p.id } })}
          />
        </div>
      )}
    </Screen>
  );
}
