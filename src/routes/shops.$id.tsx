import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { notice } from "@/lib/notice";
import { askConfirm } from "@/lib/dialog";
import { Guard } from "@/components/guard";
import { useShopChoice } from "@/components/shop-picker";
import {
  DangerButton,
  Divider,
  Empty,
  Field,
  GhostButton,
  IconAction,
  PrimaryButton,
  Row,
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
  type Category,
  type Shop,
} from "@/lib/queries";

export const Route = createFileRoute("/shops/$id")({
  head: () => ({
    meta: [
      { title: "shop details" },
      {
        name: "description",
        content: "edit a shop's name, phone number, receipt footer and the categories it sells.",
      },
      { property: "og:title", content: "shop details" },
      {
        property: "og:description",
        content: "edit a shop's name, phone number, receipt footer and the categories it sells.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Guard adminOnly>
      <ShopPage />
    </Guard>
  ),
});

function ShopPage() {
  const { id } = Route.useParams();
  const { data: shops = [], isLoading } = useShops();
  const shop = shops.find((s) => s.id === id);

  if (isLoading) return null;
  if (!shop) {
    return (
      <Screen>
        <TopBar backTo="/shops" title="shop" />
        <Empty text="that shop is gone." />
        <div className="px-4">
          <PrimaryButton onClick={() => window.history.back()}>back to shops</PrimaryButton>
        </div>
      </Screen>
    );
  }
  return <ShopDetail shop={shop} />;
}

function ShopDetail({ shop }: { shop: Shop }) {
  const navigate = useNavigate();
  const save = useSaveShop();
  const remove = useDeleteShop();
  const { choose } = useShopChoice();
  const { data: categories = [] } = useCategories();

  const [name, setName] = useState(shop.name);
  const [phone, setPhone] = useState(shop.phone ?? "");
  const [footer, setFooter] = useState(shop.footer ?? "");

  const mine = categories.filter((c) => c.shop_id === shop.id);
  const loose = categories.filter((c) => !c.shop_id);

  const dirty =
    name.trim().toLowerCase() !== shop.name ||
    (phone.trim() || null) !== (shop.phone ?? null) ||
    (footer.trim() || null) !== (shop.footer ?? null);

  const submit = async () => {
    if (name.trim().length < 2) return;
    try {
      await save.mutateAsync({
        id: shop.id,
        name: name.trim().toLowerCase(),
        phone: phone.trim() || null,
        footer: footer.trim() || null,
      });
      notice.ok("shop saved");
    } catch (err) {
      notice.from(err, "could not save the shop");
    }
  };

  const drop = async () => {
    if (mine.length) {
      notice.err("move its categories out first");
      return;
    }
    if (!(await askConfirm("remove this shop?", { action: "remove", danger: true }))) return;
    try {
      await remove.mutateAsync(shop.id);
      notice.ok("shop removed");
      void navigate({ to: "/shops" });
    } catch {
      notice.err("this shop still has sales on record, so it cannot be removed");
    }
  };

  const openMoney = () => {
    choose(shop.id);
    void navigate({ to: "/money" });
  };

  return (
    <Screen>
      <TopBar backTo="/shops" title={shop.name.toLowerCase()} srTitle="shop details" />

      <div className="pb-2">
        <Field label="shop name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
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
        <div className="px-4 pt-1">
          <PrimaryButton
            onClick={() => void submit()}
            disabled={!dirty || save.isPending || name.trim().length < 2}
          >
            {save.isPending ? "saving…" : "save changes"}
          </PrimaryButton>
        </div>
      </div>

      <Divider />
      <p className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
        categories in this shop
      </p>

      {mine.length === 0 ? (
        <Empty text="no categories in this shop yet." />
      ) : (
        mine.map((c) => <CategoryRow key={c.id} category={c} />)
      )}

      <AddCategory shopId={shop.id} />

      {loose.length ? (
        <>
          <Divider />
          <p className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
            not in any shop
          </p>
          {loose.map((c) => (
            <CategoryRow key={c.id} category={c} adoptInto={shop.id} />
          ))}
        </>
      ) : null}

      <Divider />
      <div className="space-y-2 px-4 py-5">
        <GhostButton onClick={openMoney}>see this shop's money</GhostButton>
        <DangerButton onClick={() => void drop()} className="text-sm">
          {remove.isPending ? "removing…" : "remove this shop"}
        </DangerButton>
      </div>
      <div className="h-10" />
    </Screen>
  );
}

function CategoryRow({ category, adoptInto }: { category: Category; adoptInto?: string }) {
  const saveCategory = useSaveCategory();

  const move = async (shopId: string | null) => {
    try {
      await saveCategory.mutateAsync({ id: category.id, name: category.name, shop_id: shopId });
    } catch (err) {
      notice.from(err, "could not move that category");
    }
  };

  return (
    <Row>
      <p className="min-w-0 flex-1 truncate text-[15px]">{category.name.toLowerCase()}</p>
      {adoptInto ? (
        <button
          onClick={() => void move(adoptInto)}
          className="press text-sm text-muted-foreground"
        >
          add here
        </button>
      ) : (
        <IconAction icon={X} size={22} label="take out of this shop" onClick={() => void move(null)} />
      )}
    </Row>
  );
}

function AddCategory({ shopId }: { shopId: string }) {
  const saveCategory = useSaveCategory();
  const [name, setName] = useState("");

  const add = async () => {
    const clean = name.trim().toLowerCase();
    if (clean.length < 2) return;
    try {
      await saveCategory.mutateAsync({ name: clean, shop_id: shopId });
      setName("");
      notice.ok("category added");
    } catch {
      notice.err("that category is already in this shop");
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <input
        className={inputClass}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void add();
        }}
        placeholder="new category"
      />
      <IconAction
        icon={Plus}
        size={26}
        label="add category"
        onClick={() => void add()}
      />
    </div>
  );
}
