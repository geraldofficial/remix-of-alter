import { createFileRoute, Link } from "@tanstack/react-router";
import { Guard } from "@/components/guard";
import { Divider, Empty, Row, RowsSkeleton, Screen, TopBar } from "@/components/kit";
import { money } from "@/lib/format";
import { balanceOf, useInstallments } from "@/lib/queries";

export const Route = createFileRoute("/installments/")({
  head: () => ({
    meta: [
      { title: "installments" },
      { name: "description", content: "every customer paying in bits and what they still owe." },
      { property: "og:title", content: "installments" },
      {
        property: "og:description",
        content: "every customer paying in bits and what they still owe.",
      },
    ],
  }),
  component: () => (
    <Guard>
      <InstallmentsPage />
    </Guard>
  ),
});

function InstallmentsPage() {
  const { data = [], isLoading } = useInstallments();
  const open = data.filter((i) => balanceOf(i) > 0);
  const cleared = data.filter((i) => balanceOf(i) <= 0);

  return (
    <Screen>
      <TopBar back title="installments" />
      {isLoading ? (
        <RowsSkeleton />
      ) : data.length === 0 ? (
        <Empty text="no installments yet." />
      ) : (
        <>
          {open.map((i) => (
            <Link key={i.id} to="/installments/$id" params={{ id: i.id }}>
              <Row>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px]">{i.customer_name.toLowerCase()}</p>
                  <p className="text-xs text-muted-foreground">{i.sales?.product_name ?? "item"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[15px]">{money(balanceOf(i))}</p>
                  <p className="text-xs text-muted-foreground">remaining of {money(i.total)}</p>
                </div>
              </Row>
            </Link>
          ))}
          {cleared.length ? (
            <p className="px-4 pb-2 pt-6 text-xs text-muted-foreground">cleared</p>
          ) : null}
          {cleared.length ? <Divider /> : null}
          {cleared.map((i) => (
            <Link key={i.id} to="/installments/$id" params={{ id: i.id }}>
              <Row>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-muted-foreground">
                    {i.customer_name.toLowerCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">{i.sales?.product_name ?? "item"}</p>
                </div>
                <p className="text-sm text-muted-foreground">cleared</p>
              </Row>
            </Link>
          ))}
        </>
      )}
    </Screen>
  );
}
