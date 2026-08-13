import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Printer, Share2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { notice } from "@/lib/notice";
import { supabase } from "@/integrations/supabase/client";
import { Guard } from "@/components/guard";
import { Divider, Empty, GhostButton, RowsSkeleton, Screen, TopBar } from "@/components/kit";
import { money, fullStamp } from "@/lib/format";
import { downloadReceiptPdf, shareReceiptPdf } from "@/lib/receipt-pdf";
import { useShops } from "@/lib/queries";
import { qrDataUrl, verifyUrlFor } from "@/lib/qr";

export const Route = createFileRoute("/receipt/$group")({
  head: () => ({
    meta: [
      { title: "receipt" },
      { name: "description", content: "a printable receipt for this sale." },
      { property: "og:title", content: "receipt" },
      { property: "og:description", content: "a printable receipt for this sale." },
    ],
  }),
  component: () => (
    <Guard>
      <ReceiptPage />
    </Guard>
  ),
});

function ReceiptPage() {
  const { group } = Route.useParams();
  const { data: shops = [] } = useShops();
  const { data, isLoading } = useQuery({
    queryKey: ["receipt", group],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, installments(*, installment_payments(amount))")
        .or(`group_id.eq.${group},id.eq.${group}`)
        .order("sold_at");
      if (error) throw new Error(error.message);
      return data as unknown as (import("@/lib/queries").Sale & {
        installments: {
          id: string;
          total: number;
          deposit: number;
          customer_name: string;
          installment_payments: { amount: number }[];
        }[];
      })[];
    },
  });

  const code = data?.[0]?.verify_code ?? null;
  const verifyUrl = code ? verifyUrlFor(code) : "";
  const { data: qr } = useQuery({
    queryKey: ["receipt-qr", code],
    queryFn: () => qrDataUrl(verifyUrl),
    enabled: Boolean(code),
    staleTime: Infinity,
  });

  if (isLoading)
    return (
      <Screen>
        <TopBar backTo="/" title="receipt" />
        <RowsSkeleton />
      </Screen>
    );
  if (!data || data.length === 0)
    return (
      <Screen>
        <TopBar backTo="/" title="receipt" />
        <Empty text="this receipt is missing." />
      </Screen>
    );

  const first = data[0]!;
  const total = data.reduce((s, x) => s + Number(x.sold_price), 0);
  const paid = data.reduce((s, x) => {
    const inst = x.installments?.[0];
    if (!inst) return s + Number(x.sold_price);
    return (
      s + Number(inst.deposit) + inst.installment_payments.reduce((a, p) => a + Number(p.amount), 0)
    );
  }, 0);
  const balance = total - paid;
  const customer = data.find((x) => x.installments?.[0])?.installments?.[0]?.customer_name;
  const shop = shops.find((s) => s.id === first.shop_id) ?? shops[0];
  const footer = shop?.footer?.trim() || "thank you, keep this receipt.";

  const doc = {
    heading: "receipt",
    number: first.receipt_no,
    stamp: fullStamp(first.sold_at),
    ...(shop?.name ? { shopName: shop.name.toLowerCase() } : {}),
    ...(shop?.phone ? { shopPhone: shop.phone } : {}),
    lines: data.map((s) => ({
      name: s.product_name,
      ...(s.variant ? { note: `${s.method} · ${s.variant}` } : { note: s.method }),
      amount: money(s.sold_price),
    })),
    totals: [
      { label: "total", value: money(total), strong: true },
      { label: "paid", value: money(paid) },
      ...(balance > 0 ? [{ label: "balance", value: money(balance) }] : []),
      ...(customer ? [{ label: "customer", value: customer.toLowerCase() }] : []),
      { label: "served by", value: (first.sold_by_name ?? "").toLowerCase() },
    ],
    footer,
    ...(code ? { verifyCode: code, verifyUrl } : {}),
    ...(qr ? { qr } : {}),
  };


  const share = async () => {
    const text = [
      `receipt ${first.receipt_no}`,
      fullStamp(first.sold_at),
      ...data.map(
        (s) => `${s.product_name}${s.variant ? ` (${s.variant})` : ""} — ${money(s.sold_price)}`,
      ),
      `total ${money(total)}`,
      balance > 0 ? `paid ${money(paid)} · balance ${money(balance)}` : "paid in full",
      ...(code ? [`check this receipt: ${verifyUrl}`] : []),
    ].join("\n");

    // the phone share sheet first, so the receipt can go straight to any app
    try {
      const how = await shareReceiptPdf(doc);
      if (how !== "unsupported") return;
    } catch {
      /* fall through to sharing the receipt as text */
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: `receipt ${first.receipt_no}`, text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      notice.ok("receipt copied");
    } catch {
      downloadReceiptPdf(doc);
      notice.ok("receipt saved to your downloads");
    }
  };

  const print = () => {
    // some phone browsers ignore window.print() while a drawer/scroll lock is active
    setTimeout(() => window.print(), 60);
  };

  return (
    <Screen>
      <div className="print:hidden">
        <TopBar backTo="/" title="receipt" />
      </div>

      <article className="receipt mx-auto max-w-md px-5 py-6">
        <header className="pb-4">
          {shop ? (
            <>
              <p className="text-lg font-semibold tracking-tight">{shop.name.toLowerCase()}</p>
              {shop.phone ? (
                <p className="text-sm text-muted-foreground">{shop.phone}</p>
              ) : null}
            </>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">receipt</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{first.receipt_no}</p>
          <p className="mt-1 text-sm text-muted-foreground">{fullStamp(first.sold_at)}</p>
        </header>
        <Divider />

        {data.map((s) => (
          <div key={s.id}>
            <div className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px]">{s.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.method}
                  {s.variant ? ` · ${s.variant}` : ""}
                </p>
              </div>
              <p className="text-[15px]">{money(s.sold_price)}</p>
            </div>
            <Divider />
          </div>
        ))}

        <div className="flex items-center py-3">
          <span className="flex-1 text-sm text-muted-foreground">total</span>
          <span className="text-lg font-semibold">{money(total)}</span>
        </div>
        <Divider />
        <div className="flex items-center py-3">
          <span className="flex-1 text-sm text-muted-foreground">paid</span>
          <span className="text-[15px]">{money(paid)}</span>
        </div>
        <Divider />
        {balance > 0 ? (
          <>
            <div className="flex items-center py-3">
              <span className="flex-1 text-sm text-muted-foreground">balance</span>
              <span className="text-[15px]">{money(balance)}</span>
            </div>
            <Divider />
          </>
        ) : null}
        {customer ? (
          <>
            <div className="flex items-center py-3">
              <span className="flex-1 text-sm text-muted-foreground">customer</span>
              <span className="text-[15px]">{customer.toLowerCase()}</span>
            </div>
            <Divider />
          </>
        ) : null}
        <div className="flex items-center py-3">
          <span className="flex-1 text-sm text-muted-foreground">served by</span>
          <span className="text-[15px]">{(first.sold_by_name ?? "").toLowerCase()}</span>
        </div>
        <Divider />
        {code ? (
          <div className="flex flex-col items-center gap-2 py-6">
            {qr ? (
              <img
                src={qr}
                alt={`qr code to check receipt ${first.receipt_no}`}
                className="h-32 w-32 rounded-md bg-white p-1"
              />
            ) : (
              <div className="h-32 w-32 animate-pulse rounded-md bg-muted" />
            )}
            <p className="text-xs text-muted-foreground">scan to check this receipt</p>
            <p className="font-mono text-xs tracking-widest">{code}</p>
            <a
              href={verifyUrl}
              className="text-xs text-muted-foreground underline print:hidden"
            >
              open the check page
            </a>
          </div>
        ) : null}
        <Divider />
        <p className="py-5 text-center text-xs text-muted-foreground">{footer}</p>
      </article>

      <div className="mx-auto flex max-w-md gap-2 px-4 pb-10 print:hidden">
        <GhostButton onClick={print} className="flex items-center justify-center gap-2">
          <Printer size={18} /> print
        </GhostButton>
        <GhostButton
          onClick={() => downloadReceiptPdf(doc)}
          className="flex items-center justify-center gap-2"
        >
          <Download size={18} /> pdf
        </GhostButton>
        <GhostButton
          onClick={() => void share()}
          className="flex items-center justify-center gap-2"
        >
          <Share2 size={18} /> share
        </GhostButton>
      </div>

      {balance > 0 ? (
        <div className="mx-auto max-w-md px-4 pb-10 print:hidden">
          <Link
            to="/installments"
            className="press block rounded-lg bg-secondary px-4 py-3.5 text-center text-[15px]"
          >
            open installments
          </Link>
        </div>
      ) : null}

      <div className="mx-auto max-w-md px-4 pb-12 print:hidden">
        <Link
          to="/"
          className="press block rounded-lg bg-primary px-4 py-3.5 text-center text-[15px] font-semibold text-primary-foreground"
        >
          back to home
        </Link>
      </div>
    </Screen>
  );
}
