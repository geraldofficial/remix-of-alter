import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Trash2 } from "lucide-react";
import { Guard } from "@/components/guard";
import { Divider, Empty, Row, RowsSkeleton, Screen, TopBar } from "@/components/kit";
import { askConfirm } from "@/lib/dialog";
import { notice } from "@/lib/notice";
import { useAuth } from "@/lib/auth";
import {
  useCategories,
  useDeleteCategory,
  useDeleteProducts,
  useProducts,
  type Category,
} from "@/lib/queries";

export const Route = createFileRoute("/categories/")({
  head: () => ({
    meta: [
      { title: "categories" },
      { name: "description", content: "items grouped the way the shop is organised." },
      { property: "og:title", content: "categories" },
      { property: "og:description", content: "items grouped the way the shop is organised." },
    ],
  }),
  component: () => (
    <Guard>
      <CategoriesPage />
    </Guard>
  ),
});

function CategoriesPage() {
  const { isAdmin } = useAuth();
  const { data: categories = [], isLoading } = useCategories();
  const { data: products = [] } = useProducts();
  const removeCategory = useDeleteCategory();
  const removeProducts = useDeleteProducts();

  const busy = removeCategory.isPending || removeProducts.isPending;

  /**
   * Removing a category asks what should happen to what is inside it: the items
   * can stay in the shop with no category, or go with it.
   */
  const remove = async (c: Category) => {
    if (busy) return;
    const inside = products.filter((p) => p.category_id === c.id);
    const ok = await askConfirm(
      inside.length
        ? `remove "${c.name.toLowerCase()}"? its ${inside.length} ${inside.length === 1 ? "item" : "items"} stay in the shop.`
        : `remove "${c.name.toLowerCase()}"?`,
      { action: "remove", danger: true },
    );
    if (!ok) return;

    const alsoItems =
      inside.length > 0 &&
      (await askConfirm(
        `delete the ${inside.length} ${inside.length === 1 ? "item" : "items"} in it as well?`,
        { action: "delete items", danger: true },
      ));

    try {
      if (alsoItems) await removeProducts.mutateAsync(inside.map((p) => p.id));
      await removeCategory.mutateAsync(c.id);
      notice.ok(alsoItems ? "category and its items removed" : "category removed");
    } catch (err) {
      notice.from(err, "could not remove that category");
    }
  };

  return (
    <Screen>
      <TopBar back title="categories" />
      {isLoading ? (
        <RowsSkeleton />
      ) : categories.length === 0 ? (
        <Empty text="no categories yet." />
      ) : (
        categories.map((c) => (
          <Row key={c.id}>
            <Link
              to="/categories/$id"
              params={{ id: c.id }}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span className="flex-1 truncate text-[15px]">{c.name.toLowerCase()}</span>
              <span className="text-sm text-muted-foreground">
                {products.filter((p) => p.category_id === c.id).length}
              </span>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Link>
            {isAdmin ? (
              <button
                onClick={() => void remove(c)}
                disabled={busy}
                aria-label={`remove ${c.name}`}
                className="press pl-2 text-destructive disabled:opacity-50"
              >
                <Trash2 size={18} />
              </button>
            ) : null}
          </Row>
        ))
      )}
      <Divider />
    </Screen>
  );
}
