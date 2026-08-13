import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { notice } from "@/lib/notice";
import { askConfirm } from "@/lib/dialog";
import { Guard } from "@/components/guard";
import {
  DangerButton,
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
import {
  useCategories,
  useDeleteShop,
  useSaveCategory,
  useSaveShop,
  useShops,
  type Shop,
} from "@/lib/queries";

export const Route = createFileRoute("/shops")({
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
  const [editing, setEditing] = useState<Shop | "new" | null>(null);

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
        shops.map((s) => <ShopRow key={s.id} shop={s} onEdit={() => setEditing(s)} />)
      )}

      <div className="px-4 py-5">
        <PrimaryButton onClick={() => setEditing("new")}>add a shop</PrimaryButton>
      </div>

      {editing ? (
        <ShopSheet
          {...(editing === "new" ? {} : { shop: editing })}
          onDone={() => setEditing(null)}
        />
      ) : null}
      <div className="h-10" />
    </Screen>
  );
}

function ShopRow({ shop, onEdit }: { shop: Shop; onEdit: () => void }) {
  const { data: categories = [] } = useCategories();
  const mine = categories.filter((c) => c.shop_id === shop.id);

  return (
    <>
      <Row as="button" onClick={onEdit}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px]">{shop.name.toLowerCase()}</p>
          <p className="text-xs text-muted-foreground">
            {shop.phone ? `${shop.phone} · ` : ""}
            {mine.length} {mine.length === 1 ? "category" : "categories"}
          </p>
        </div>
        <span className="text-sm text-muted-foreground">edit</span>
      </Row>
      <CategoryMover shop={shop} />
    </>
  );
}

/** Moves a category into this shop, or out of it. */
function CategoryMover({ shop }: { shop: Shop }) {
  const { data: categories = [] } = useCategories();
  const saveCategory = useSaveCategory();

  const move = async (id: string, name: string, into: boolean) => {
    try {
      await saveCategory.mutateAsync({ id, name, shop_id: into ? shop.id : null });
    } catch (err) {
      notice.from(err, "could not move that category");
    }
  };

  if (!categories.length) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-4">
      {categories.map((c) => {
        const mine = c.shop_id === shop.id;
        return (
          <button
            key={c.id}
            onClick={() => void move(c.id, c.name, !mine)}
            className={`press rounded-full px-3 py-1.5 text-xs ${
              mine ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {c.name.toLowerCase()}
          </button>
        );
      })}
    </div>
  );
}

function ShopSheet({ shop, onDone }: { shop?: Shop; onDone: () => void }) {
  const save = useSaveShop();
  const remove = useDeleteShop();
  const [name, setName] = useState(shop?.name ?? "");
  const [phone, setPhone] = useState(shop?.phone ?? "");
  const [footer, setFooter] = useState(shop?.footer ?? "");

  const submit = async () => {
    if (name.trim().length < 2) return;
    try {
      await save.mutateAsync({
        ...(shop ? { id: shop.id } : {}),
        name: name.trim().toLowerCase(),
        phone: phone.trim() || null,
        footer: footer.trim() || null,
      });
      notice.ok(shop ? "shop saved" : "shop added");
      onDone();
    } catch (err) {
      notice.from(err, "could not save the shop");
    }
  };

  const drop = async () => {
    if (!shop) return;
    if (!(await askConfirm("remove this shop?", { action: "remove", danger: true }))) return;
    try {
      await remove.mutateAsync(shop.id);
      notice.ok("shop removed");
      onDone();
    } catch (err) {
      notice.from(err, "could not remove the shop");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-background/70 backdrop-blur">
      <div className="mx-auto w-full max-w-md rounded-t-2xl bg-background pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
        <p className="px-4 pb-2 text-[15px]">{shop ? "edit shop" : "new shop"}</p>
        <Field label="shop name">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="shop name on the receipt"
            autoFocus
          />
        </Field>
        <Field label="phone" hint="customers see this on the receipt">
          <input
            className={inputClass}
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07…"
          />
        </Field>
        <Field label="receipt footer">
          <input
            className={inputClass}
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            placeholder="thank you, keep this receipt."
          />
        </Field>

        <div className="flex gap-2 px-4 pt-2">
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
        {shop ? (
          <DangerButton onClick={() => void drop()} className="mt-2 text-sm">
            {remove.isPending ? "removing…" : "remove this shop"}
          </DangerButton>
        ) : null}
      </div>
    </div>
  );
}
