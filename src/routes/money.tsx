import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Search } from "lucide-react";
import { Guard } from "@/components/guard";
import {
  Divider,
  Empty,
  GhostButton,
  PrimaryButton,
  Row,
  RowsSkeleton,
  Screen,
  Tabs,
  TopBar,
  DangerButton,
  inputClass,
} from "@/components/kit";

import { SalesCalendar } from "@/components/sales-calendar";
import { ShopPicker, useShopChoice } from "@/components/shop-picker";
import { notice } from "@/lib/notice";
import { money, shortTime, fullStamp } from "@/lib/format";
import {
  balanceOf,
  useDeleteSale,
  useInstallments,
  useSales,
  useUpdateSale,
  type Sale,
} from "@/lib/queries";

export const Route = createFileRoute("/money")({
  head: () => ({
    meta: [
      { title: "money" },
      { name: "description", content: "every receipt, what came in and what is still owed." },
      { property: "og:title", content: "money" },
      {
        property: "og:description",
        content: "every receipt, what came in and what is still owed.",
      },
    ],
  }),
  component: () => (
    <Guard adminOnly>
      <MoneyPage />
    </Guard>
  ),
});

type Tab = "totals" | "days" | "receipts" | "owed";

const dayStart = (offsetDays: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString();
};

function MoneyPage() {
  const [tab, setTab] = useState<Tab>("totals");
  const { data: allSales = [], isLoading } = useSales();
  const { data: allInstallments = [] } = useInstallments();
  const { shops, shopId, choose } = useShopChoice();

  const sales = shopId ? allSales.filter((s) => s.shop_id === shopId) : allSales;
  const installments = shopId
    ? allInstallments.filter((i) => i.sales?.shop_id === shopId)
    : allInstallments;

  return (
    <Screen>
      <TopBar backTo="/" title="money" />

      <ShopPicker shops={shops} value={shopId} onChange={choose} />

      <Tabs
        className="px-4 pb-3 pt-3"
        value={tab}
        options={["totals", "days", "receipts", "owed"] as const}
        onChange={setTab}
      />




      {isLoading ? (
        <RowsSkeleton />
      ) : tab === "totals" ? (
        <Totals sales={sales} installments={installments} />
      ) : tab === "days" ? (
        <SalesCalendar sales={sales} />
      ) : tab === "receipts" ? (
        <Receipts sales={sales} />
      ) : (
        <Owed installments={installments} />
      )}
      <div className="h-16" />
    </Screen>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Row>
      <span className="flex-1 text-[15px] text-muted-foreground">{label}</span>
      <span className={strong ? "text-[15px] font-semibold" : "text-[15px]"}>{value}</span>
    </Row>
  );
}

function Totals({
  sales,
  installments,
}: {
  sales: Sale[];
  installments: ReturnType<typeof useInstallments>["data"];
}) {
  const stats = useMemo(() => {
    const today = dayStart(0);
    const week = dayStart(6);
    const month = dayStart(29);
    const sum = (rows: Sale[]) => rows.reduce((s, x) => s + Number(x.sold_price), 0);
    const inRange = (from: string) => sales.filter((s) => s.sold_at >= from);
    const todays = inRange(today);
    const byMethod = { cash: 0, mpesa: 0, installment: 0 };
    const bySeller = new Map<string, number>();
    const byProduct = new Map<string, number>();
    let cost = 0;
    for (const s of sales) {
      byMethod[s.method] += Number(s.sold_price);
      cost += Number(s.base_price);
      const seller = (s.sold_by_name ?? "unknown").toLowerCase();
      bySeller.set(seller, (bySeller.get(seller) ?? 0) + Number(s.sold_price));
      byProduct.set(s.product_name, (byProduct.get(s.product_name) ?? 0) + Number(s.sold_price));
    }
    const top = (map: Map<string, number>) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      today: sum(todays),
      todayCount: todays.length,
      week: sum(inRange(week)),
      month: sum(inRange(month)),
      all: sum(sales),
      profit: sum(sales) - cost,
      byMethod,
      sellers: top(bySeller),
      products: top(byProduct),
      owed: (installments ?? []).reduce((s, i) => s + Math.max(0, balanceOf(i)), 0),
    };
  }, [sales, installments]);

  return (
    <>
      <section className="px-4 pb-5">
        <p className="text-xs text-muted-foreground">taken today</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{money(stats.today)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {stats.todayCount} {stats.todayCount === 1 ? "sale" : "sales"} · {money(stats.owed)} still
          owed
        </p>
      </section>
      <Divider />

      <Line label="last 7 days" value={money(stats.week)} />
      <Line label="last 30 days" value={money(stats.month)} />
      <Line label="all time" value={money(stats.all)} strong />
      <Line label="above cost" value={money(stats.profit)} />

      <p className="px-4 pb-2 pt-6 text-xs text-muted-foreground">how it was paid</p>
      <Line label="cash" value={money(stats.byMethod.cash)} />
      <Line label="mpesa" value={money(stats.byMethod.mpesa)} />
      <Line label="installment" value={money(stats.byMethod.installment)} />

      <p className="px-4 pb-2 pt-6 text-xs text-muted-foreground">who sold most</p>
      {stats.sellers.length ? (
        stats.sellers.map(([name, value]) => <Line key={name} label={name} value={money(value)} />)
      ) : (
        <Empty text="no sales yet." />
      )}

      <p className="px-4 pb-2 pt-6 text-xs text-muted-foreground">what sells most</p>
      {stats.products.length ? (
        stats.products.map(([name, value]) => <Line key={name} label={name} value={money(value)} />)
      ) : (
        <Empty text="no sales yet." />
      )}
    </>
  );
}

function Receipts({ sales }: { sales: Sale[] }) {
  const [term, setTerm] = useState("");
  const [editing, setEditing] = useState<Sale | null>(null);

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) =>
      `${s.receipt_no} ${s.product_name} ${s.variant ?? ""} ${s.sold_by_name ?? ""} ${s.method}`
        .toLowerCase()
        .includes(q),
    );
  }, [sales, term]);

  return (
    <>
      <div className="relative px-4 pb-4">
        <Search
          size={16}
          className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="receipt, item, seller"
          className={`${inputClass} pl-9`}
        />
      </div>

      {rows.length === 0 ? (
        <Empty text="no receipts match that." />
      ) : (
        rows.slice(0, 300).map((s) => (
          <Row key={s.id}>
            <Link
              to="/receipt/$group"
              params={{ group: s.group_id ?? s.id }}
              className="min-w-0 flex-1"
            >
              <p className="truncate text-[15px]">{s.product_name}</p>
              <p className="text-xs text-muted-foreground">
                {s.receipt_no} · {shortTime(s.sold_at)} · {s.method}
                {s.sold_by_name ? ` · ${s.sold_by_name.toLowerCase()}` : ""}
              </p>
            </Link>
            <button onClick={() => setEditing(s)} className="press text-[15px]">
              {money(s.sold_price)}
            </button>
            <ChevronRight size={18} className="text-muted-foreground" />
          </Row>
        ))
      )}

      {editing ? <EditSale sale={editing} onDone={() => setEditing(null)} /> : null}
    </>
  );
}

function EditSale({ sale, onDone }: { sale: Sale; onDone: () => void }) {
  const update = useUpdateSale();
  const remove = useDeleteSale();
  const [price, setPrice] = useState(String(sale.sold_price));
  const [method, setMethod] = useState(sale.method);

  const save = async () => {
    try {
      await update.mutateAsync({ id: sale.id, sold_price: Number(price) || 0, method });
      notice.ok("sale updated");
      onDone();
    } catch (err) {
      notice.from(err, "could not update this sale");
    }
  };

  const drop = async () => {
    try {
      await remove.mutateAsync(sale.id);
      notice.ok("sale removed");
      onDone();
    } catch (err) {
      notice.from(err, "could not remove this sale");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-background/70 backdrop-blur">
      <div className="mx-auto w-full max-w-md rounded-t-2xl bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5">
        <p className="text-[15px]">{sale.product_name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {sale.receipt_no} · {fullStamp(sale.sold_at)}
        </p>

        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          className={`${inputClass} mt-4`}
          placeholder="amount"
        />
        <div className="mt-2 flex gap-1">
          {(["cash", "mpesa", "installment"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`press flex-1 rounded-lg px-3 py-2 text-sm ${
                method === m ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <GhostButton onClick={onDone} className="w-auto flex-1">
            close
          </GhostButton>
          <PrimaryButton
            onClick={() => void save()}
            disabled={update.isPending}
            className="w-auto flex-[2]"
          >
            {update.isPending ? "saving…" : "save"}
          </PrimaryButton>
        </div>
        <DangerButton onClick={() => void drop()} className="mt-3 text-sm">
          {remove.isPending ? "removing…" : "remove this sale"}
        </DangerButton>

      </div>
    </div>
  );
}

function Owed({ installments }: { installments: ReturnType<typeof useInstallments>["data"] }) {
  const rows = (installments ?? [])
    .map((i) => ({ i, left: balanceOf(i) }))
    .filter(({ left }) => left > 0);
  const total = rows.reduce((s, r) => s + r.left, 0);

  if (!rows.length) return <Empty text="nothing is owed right now." />;

  return (
    <>
      <section className="px-4 pb-5">
        <p className="text-xs text-muted-foreground">still owed</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{money(total)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "customer" : "customers"}
        </p>
      </section>
      <Divider />
      {rows.map(({ i, left }) => (
        <Link key={i.id} to="/installments/$id" params={{ id: i.id }}>
          <Row>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px]">{i.customer_name.toLowerCase()}</p>
              <p className="text-xs text-muted-foreground">
                {i.sales?.product_name ?? "item"} · paid {money(Number(i.total) - left)}
              </p>
            </div>
            <p className="text-[15px]">{money(left)}</p>
            <ChevronRight size={18} className="text-muted-foreground" />
          </Row>
        </Link>
      ))}
    </>
  );
}
