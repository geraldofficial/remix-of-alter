import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { notice } from "@/lib/notice";
import {
  Divider,
  Field,
  GhostButton,
  LoadingDots,
  PrimaryButton,
  StickyBar,
  inputClass,
} from "@/components/kit";
import { Media } from "@/components/media";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useCategories, useRecordSales, type NewSale, type Product } from "@/lib/queries";

type Method = "cash" | "mpesa" | "installment";
type Entry = { price: string; variant: string; method: Method; deposit: string };

const emptyEntry = (p: Product): Entry => ({
  price: String(p.base_price ?? ""),
  variant: p.variants?.[0] ?? "",
  method: "cash",
  deposit: "",
});

const METHODS: { key: Method; label: string }[] = [
  { key: "cash", label: "cash" },
  { key: "mpesa", label: "mpesa" },
  { key: "installment", label: "installments" },
];

export function SaleFlow({ products, onCancel }: { products: Product[]; onCancel?: () => void }) {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const record = useRecordSales();
  const { data: categories = [] } = useCategories();
  const [step, setStep] = useState(0);
  const [entries, setEntries] = useState<Entry[]>(() => products.map(emptyEntry));
  const [customer, setCustomer] = useState({ name: "", phone: "", note: "" });
  /** asks once before writing, and never lets a second tap through */
  const [asking, setAsking] = useState(false);
  const sent = useRef(false);

  const needsCustomer = entries.some((e) => e.method === "installment");
  const lastItemStep = products.length - 1;
  const customerStep = needsCustomer ? products.length : -1;
  const confirmStep = needsCustomer ? products.length + 1 : products.length;

  const patch = (i: number, part: Partial<Entry>) =>
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...part } : e)));

  const total = entries.reduce((s, e) => s + Number(e.price || 0), 0);

  const canContinue = () => {
    if (step <= lastItemStep) {
      const e = entries[step]!;
      if (!Number(e.price)) return false;
      if (e.method === "installment" && Number(e.deposit) > Number(e.price)) return false;
      return true;
    }
    if (step === customerStep) return customer.name.trim().length > 1;
    return true;
  };

  const shopOf = (p: Product) =>
    categories.find((c) => c.id === p.category_id)?.shop_id ?? null;

  const submit = async () => {
    if (!session?.user.id || sent.current) return;
    sent.current = true;
    const group_id = crypto.randomUUID();
    const payload: NewSale[] = products.map((p, i) => {
      const e = entries[i]!;
      return {
        product_id: p.id,
        product_name: p.name,
        base_price: Number(p.base_price),
        variant: e.variant || null,
        sold_price: Number(e.price),
        method: e.method,
        sold_by: session.user.id,
        sold_by_name: profile?.name ?? "",
        group_id,
        shop_id: shopOf(p),
        ...(e.method === "installment"
          ? {
              customer: {
                name: customer.name.trim(),
                phone: customer.phone.trim(),
                note: customer.note.trim(),
                deposit: Number(e.deposit || 0),
              },
            }
          : {}),
      };
    });
    try {
      const res = await record.mutateAsync(payload);
      if (res.queued) {
        notice.ok("no connection — the sale is saved and will sync itself");
        onCancel?.();
        return;
      }
      navigate({ to: "/receipt/$group", params: { group: group_id } });
    } catch (err) {
      sent.current = false;
      setAsking(false);
      notice.from(err, "the sale could not be saved");
    }
  };


  return (
    <div className="flex max-h-[88dvh] flex-col">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs text-muted-foreground">
          step {step + 1} of {confirmStep + 1}
        </span>
        {products.length > 1 ? (
          <span className="text-xs text-muted-foreground">· {products.length} items</span>
        ) : null}
      </div>
      <Divider />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {step <= lastItemStep ? (
          <ItemStep
            product={products[step]!}
            entry={entries[step]!}
            onChange={(part) => patch(step, part)}
          />
        ) : step === customerStep ? (
          <div>
            <p className="px-4 pt-4 text-sm text-muted-foreground">
              customer details for the installment
            </p>
            <Field label="name">
              <input
                className={inputClass}
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                placeholder="customer name"
              />
            </Field>
            <Divider />
            <Field label="phone">
              <input
                className={inputClass}
                inputMode="tel"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                placeholder="07…"
              />
            </Field>
            <Divider />
            <Field label="note">
              <input
                className={inputClass}
                value={customer.note}
                onChange={(e) => setCustomer({ ...customer, note: e.target.value })}
                placeholder="anything worth remembering"
              />
            </Field>
          </div>
        ) : (
          <div className="py-2">
            {products.map((p, i) => {
              const e = entries[i]!;
              return (
                <div key={p.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                      <Media
                        path={p.product_media?.[0]?.url}
                        alt={p.name}
                        className="h-12 w-12 object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.method}
                        {e.variant ? ` · ${e.variant}` : ""}
                        {e.method === "installment" ? ` · deposit ${money(e.deposit || 0)}` : ""}
                      </p>
                    </div>
                    <p className="text-sm">{money(e.price)}</p>
                  </div>
                  <Divider />
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm text-muted-foreground">total</span>
              <span className="text-lg font-semibold">{money(total)}</span>
            </div>
          </div>
        )}
      </div>

      <StickyBar>
        {asking ? (
          <div>
            <p className="pb-3 text-center text-sm text-muted-foreground">
              record this sale of {money(total)}?
            </p>
            <div className="flex gap-2">
              <GhostButton
                onClick={() => setAsking(false)}
                disabled={record.isPending}
                className="w-auto flex-1"
              >
                not yet
              </GhostButton>
              <PrimaryButton
                onClick={() => void submit()}
                disabled={record.isPending || sent.current}
                className={`w-auto flex-[2] gap-2 ${
                  record.isPending || sent.current ? "pointer-events-none" : ""
                }`}
              >
                {record.isPending || sent.current ? (
                  <>
                    <LoadingDots className="[&>span]:bg-primary-foreground" />
                    saving…
                  </>
                ) : (
                  "yes, record it"
                )}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <GhostButton
              onClick={() => (step === 0 ? onCancel?.() : setStep(step - 1))}
              className="w-auto flex-1"
            >
              {step === 0 ? "cancel" : "back"}
            </GhostButton>
            <PrimaryButton
              disabled={!canContinue() || record.isPending || sent.current}
              onClick={() => (step === confirmStep ? setAsking(true) : setStep(step + 1))}
              className="w-auto flex-[2]"
            >
              {step === confirmStep ? "conclude sale" : "next"}
            </PrimaryButton>
          </div>
        )}
      </StickyBar>

    </div>
  );
}

function ItemStep({
  product,
  entry,
  onChange,
}: {
  product: Product;
  entry: Entry;
  onChange: (part: Partial<Entry>) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
          <Media
            path={product.product_media?.[0]?.url}
            alt={product.name}
            className="h-14 w-14 object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px]">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            base {money(product.base_price)} · {product.stock} in stock
          </p>
        </div>
      </div>
      <Divider />

      <Field label="sold for">
        <input
          className={inputClass}
          inputMode="decimal"
          value={entry.price}
          onChange={(e) => onChange({ price: e.target.value.replace(/[^\d.]/g, "") })}
          placeholder="0"
          autoFocus
        />
      </Field>
      <Divider />

      {product.variants?.length ? (
        <>
          <div className="px-4 py-3">
            <p className="mb-2 text-xs text-muted-foreground">variant</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v}
                  onClick={() => onChange({ variant: entry.variant === v ? "" : v })}
                  className={`press rounded-full px-3.5 py-2 text-sm ${
                    entry.variant === v
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <Divider />
        </>
      ) : null}

      <div className="px-4 py-3">
        <p className="mb-2 text-xs text-muted-foreground">payment</p>
        <div className="flex gap-2">
          {METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => onChange({ method: m.key })}
              className={`press flex-1 rounded-lg px-3 py-3 text-sm ${
                entry.method === m.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <Divider />

      {entry.method === "installment" ? (
        <Field
          label="deposit paid now"
          hint={`balance ${money(Number(entry.price || 0) - Number(entry.deposit || 0))}`}
        >
          <input
            className={inputClass}
            inputMode="decimal"
            value={entry.deposit}
            onChange={(e) => onChange({ deposit: e.target.value.replace(/[^\d.]/g, "") })}
            placeholder="0"
          />
        </Field>
      ) : null}
    </div>
  );
}
