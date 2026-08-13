import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { Divider, Empty, Screen, TopBar } from "@/components/kit";
import { fullStamp, money } from "@/lib/format";
import { verifyReceipt, type VerifyResult } from "@/lib/verify.functions";

export const Route = createFileRoute("/verify/$code")({
  head: () => ({
    meta: [
      { title: "check a receipt" },
      {
        name: "description",
        content: "scan or open the code on a receipt to confirm the sale is genuine.",
      },
      { property: "og:title", content: "check a receipt" },
      {
        property: "og:description",
        content: "scan or open the code on a receipt to confirm the sale is genuine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ params }): Promise<VerifyResult> => {
    try {
      return await verifyReceipt({ data: { code: params.code } });
    } catch {
      return { ok: false };
    }
  },
  errorComponent: () => (
    <Screen>
      <TopBar backTo="/" title="check a receipt" />
      <Empty text="the check could not run just now, try again." />
    </Screen>
  ),
  notFoundComponent: () => (
    <Screen>
      <TopBar backTo="/" title="check a receipt" />
      <Empty text="no receipt matches that code." />
    </Screen>
  ),
  component: VerifyPage,
});

function VerifyPage() {
  const { code } = Route.useParams();
  const result = Route.useLoaderData() as VerifyResult;

  return (
    <Screen>
      <TopBar backTo="/" title="check a receipt" />

      <section className="mx-auto max-w-md px-5 py-8">
        {result.ok ? (
          <>
            <div className="flex items-center gap-3">
              <BadgeCheck size={28} className="text-primary" />
              <div>
                <h2 className="text-xl font-semibold tracking-tight">genuine receipt</h2>
                <p className="text-sm text-muted-foreground">
                  this sale is in {result.shop?.name.toLowerCase() ?? "the shop"}&apos;s books.
                </p>
              </div>
            </div>

            <div className="mt-7">
              {result.shop ? (
                <>
                  <p className="text-lg font-semibold tracking-tight">
                    {result.shop.name.toLowerCase()}
                  </p>
                  {result.shop.phone ? (
                    <p className="text-sm text-muted-foreground">{result.shop.phone}</p>
                  ) : null}
                </>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">receipt</p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{result.receipt_no}</p>
              <p className="mt-1 text-sm text-muted-foreground">{fullStamp(result.sold_at)}</p>
            </div>

            <div className="mt-6">
              <Divider />
              {result.items.map((item, i) => (
                <div key={`${item.name}-${i}`}>
                  <div className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px]">{item.name}</p>
                      {item.variant ? (
                        <p className="text-xs text-muted-foreground">{item.variant}</p>
                      ) : null}
                    </div>
                    <p className="text-[15px]">{money(item.amount)}</p>
                  </div>
                  <Divider />
                </div>
              ))}
              <div className="flex items-center py-3">
                <span className="flex-1 text-sm text-muted-foreground">total</span>
                <span className="text-lg font-semibold">{money(result.total)}</span>
              </div>
              <Divider />
              {result.served_by ? (
                <>
                  <div className="flex items-center py-3">
                    <span className="flex-1 text-sm text-muted-foreground">served by</span>
                    <span className="text-[15px]">{result.served_by.toLowerCase()}</span>
                  </div>
                  <Divider />
                </>
              ) : null}
            </div>

            <p className="mt-5 text-xs text-muted-foreground">code {code.toUpperCase()}</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <ShieldAlert size={28} className="text-destructive" />
              <div>
                <h2 className="text-xl font-semibold tracking-tight">no matching sale</h2>
                <p className="text-sm text-muted-foreground">
                  nothing in the books carries this code, so the receipt cannot be trusted.
                </p>
              </div>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">code {code.toUpperCase()}</p>
            <p className="mt-6 text-sm text-muted-foreground">
              working here?{" "}
              <Link to="/" className="underline">
                open the shop app
              </Link>
              .
            </p>
          </>
        )}
      </section>
    </Screen>
  );
}
