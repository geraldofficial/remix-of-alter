import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { notice } from "@/lib/notice";
import { Guard } from "@/components/guard";
import {
  Divider,
  Empty,
  Field,
  GhostButton,
  PrimaryButton,
  Row,
  RowsSkeleton,
  Screen,
  TopBar,
  inputClass,
} from "@/components/kit";
import { useCategories, useSaveShop, useShops, type Shop } from "@/lib/queries";

export const Route = createFileRoute("/shops/")({
  head: () => ({
    meta: [
      { title: "shops" },
      {
        name: "description",
        content: "run several shops from one app: names, phone numbers and their categories.",
      },
      { property: "og:title", content: "shops" },
      {
        property: "og:description",
        content: "run several shops from one app: names, phone numbers and their categories.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Guard adminOnly>
      <ShopsPage />
    </Guard>
  ),
});

function ShopsPage() {
  const { data: shops = [], isLoading } = useShops();
  const { data: categories = [] } = useCategories();
  const [adding, setAdding] = useState(false);
  const loose = categories.filter((c) => !c.shop_id).length;

  return (
    <Screen>
      <TopBar backTo="/" title="shops" />
      <p className="px-4 pb-4 text-sm text-muted-foreground">
        each shop keeps its own categories, so anything sold in them counts only for that shop.
      </p>
      <Divider />

      {isLoading ? (
        <RowsSkeleton rows={3} />
      ) : shops.length === 0 ? (
        <Empty text="no shops yet." />
      ) : (
        shops.map((s) => <ShopRow key={s.id} shop={s} count={countFor(categories, s.id)} />)
      )}

      {loose > 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          {loose} {loose === 1 ? "category is" : "categories are"} not in any shop yet. open a shop
          to bring them in.
        </p>
      ) : null}

      <div className="px-4 py-5">
        {adding ? (
          <NewShop onDone={() => setAdding(false)} />
        ) : (
          <PrimaryButton onClick={() => setAdding(true)}>add a shop</PrimaryButton>
        )}
      </div>
      <div className="h-10" />
    </Screen>
  );
}

const countFor = (categories: { shop_id: string | null }[], shopId: string) =>
  categories.filter((c) => c.shop_id === shopId).length;

function ShopRow({ shop, count }: { shop: Shop; count: number }) {
  const navigate = useNavigate();
  return (
    <Row as="button" onClick={() => void navigate({ to: "/shops/$id", params: { id: shop.id } })}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px]">{shop.name.toLowerCase()}</p>
        <p className="truncate text-xs text-muted-foreground">
          {shop.phone ? `${shop.phone} · ` : ""}
          {count} {count === 1 ? "category" : "categories"}
        </p>
      </div>
      <ChevronRight size={20} className="shrink-0 text-muted-foreground" aria-hidden />
    </Row>
  );
}

function NewShop({ onDone }: { onDone: () => void }) {
  const save = useSaveShop();
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const submit = async () => {
    if (name.trim().length < 2) return;
    try {
      await save.mutateAsync({ name: name.trim().toLowerCase(), phone: null, footer: null });
      notice.ok("shop added");
      onDone();
      void navigate({ to: "/shops" });
    } catch (err) {
      notice.from(err, "could not save the shop");
    }
  };

  return (
    <div className="space-y-2">
      <Field label="shop name">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="shop name on the receipt"
          autoFocus
        />
      </Field>
      <div className="flex gap-2">
        <GhostButton onClick={onDone} className="w-auto flex-1">
          cancel
        </GhostButton>
        <PrimaryButton
          onClick={() => void submit()}
          disabled={save.isPending || name.trim().length < 2}
          className="w-auto flex-[2]"
        >
          {save.isPending ? "saving…" : "save"}
        </PrimaryButton>
      </div>
    </div>
  );
}
