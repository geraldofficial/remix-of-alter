import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Settings, ChevronRight } from "lucide-react";
import { notice } from "@/lib/notice";
import { Guard } from "@/components/guard";
import {
  Empty,
  IconLink,
  Panel,
  Row,
  RowsSkeleton,
  Screen,
  TopBar,
} from "@/components/kit";

import { ShopPicker, useShopChoice } from "@/components/shop-picker";
import { useAuth } from "@/lib/auth";
import { money, shortTime } from "@/lib/format";
import { balanceOf, useCloseDay, useInstallments, useTodaySales } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Sales, Installments & Stock" },
      { name: "description", content: "See today's takings, open installments and shop stock at a glance, then record a new sale in seconds." },
      { property: "og:title", content: "Today — Sales, Installments & Stock" },
      {
        property: "og:description",
        content: "See today's takings, open installments and shop stock at a glance, then record a new sale in seconds.",
      },
    ],
  }),
  component: () => (
    <Guard>
      <Dashboard />
    </Guard>
  ),
});

function Dashboard() {
  const { profile, isAdmin, session } = useAuth();
  const { data: allSales = [], isLoading } = useTodaySales();
  const { data: allInstallments = [] } = useInstallments();
  const closeDay = useCloseDay();
  const { shops, shopId, choose } = useShopChoice();

  const sales = shopId ? allSales.filter((s) => s.shop_id === shopId) : allSales;
  const installments = shopId
    ? allInstallments.filter((i) => i.sales?.shop_id === shopId)
    : allInstallments;

  const total = sales.reduce((s, x) => s + Number(x.sold_price), 0);
  const openInstallments = installments.filter((i) => balanceOf(i) > 0).length;

  const conclude = async () => {
    if (!session?.user.id) return;
    const day = new Date().toISOString().slice(0, 10);
    try {
      await closeDay.mutateAsync({
        day,
        total,
        count: sales.length,
        closed_by: session.user.id,
        shop_id: shopId,
      });
      notice.ok(`day closed at ${money(total)}`);
    } catch (err) {
      notice.from(err, "could not close the day");
    }
  };

  return (
    <Screen>
      <TopBar
        title={profile?.name ? profile.name.toLowerCase() : "today"}
        srTitle="shop sales dashboard"
        right={<IconLink to="/settings" icon={Settings} label="settings" />}
      />

      {isAdmin ? <ShopPicker shops={shops} value={shopId} onChange={choose} /> : null}

      <section className="px-4 py-6">
        <h2 className="text-xs text-muted-foreground">sold today</h2>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{money(total)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {sales.length} {sales.length === 1 ? "sale" : "sales"}
        </p>
      </section>
      

      

      <nav className="px-4 pt-5" aria-labelledby="shortcuts-heading">
        <h2 id="shortcuts-heading" className="sr-only">
          shop shortcuts
        </h2>
        <Panel>
          <Link to="/installments">
            <Row>
              <span className="flex-1 text-[15px]">installments</span>
              <span className="text-sm text-muted-foreground">{openInstallments} open</span>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Row>
          </Link>
          <Link to="/products">
            <Row>
              <span className="flex-1 text-[15px]">sell an item</span>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Row>
          </Link>
          {isAdmin ? (
            <>
              <Link to="/money">
                <Row>
                  <span className="flex-1 text-[15px]">money</span>
                  <span className="text-sm text-muted-foreground">receipts and totals</span>
                  <ChevronRight size={18} className="text-muted-foreground" />
                </Row>
              </Link>
              <Link to="/people">
                <Row>
                  <span className="flex-1 text-[15px]">people</span>
                  <ChevronRight size={18} className="text-muted-foreground" />
                </Row>
              </Link>
              <Link to="/manage">
                <Row>
                  <span className="flex-1 text-[15px]">products and stock</span>
                  <ChevronRight size={18} className="text-muted-foreground" />
                </Row>
              </Link>
              <Link to="/shops">
                <Row>
                  <span className="flex-1 text-[15px]">shops</span>
                  <span className="text-sm text-muted-foreground">
                    {shops.length} {shops.length === 1 ? "shop" : "shops"}
                  </span>
                  <ChevronRight size={18} className="text-muted-foreground" />
                </Row>
              </Link>
              <Row as="button" onClick={() => void conclude()}>
                <span className="flex-1 text-[15px]">conclude today sales</span>
                <span className="text-sm text-muted-foreground">
                  {closeDay.isPending ? "saving…" : money(total)}
                </span>
              </Row>
            </>
          ) : null}
        </Panel>
      </nav>

      <p className="px-4 pb-2 pt-6 text-xs text-muted-foreground">today</p>
      {isLoading ? (
        <RowsSkeleton rows={4} />
      ) : sales.length === 0 ? (
        <Empty text="nothing sold yet today." />
      ) : (
        sales.map((s) => (
          <Link key={s.id} to="/receipt/$group" params={{ group: s.group_id ?? s.id }}>
            <Row>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px]">{s.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {shortTime(s.sold_at)} · {s.method}
                  {s.sold_by_name ? ` · ${s.sold_by_name.toLowerCase()}` : ""}
                </p>
              </div>
              <p className="text-[15px]">{money(s.sold_price)}</p>
            </Row>
          </Link>
        ))
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md justify-end px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="pointer-events-auto rounded-full bg-background/80 p-1 backdrop-blur">
          <IconLink
            to={isAdmin ? "/manage" : "/products"}
            icon={Plus}
            label="add"
            size={32}
            className="text-info"
          />
        </div>
      </div>

      <div className="h-24" />
    </Screen>
  );
}
