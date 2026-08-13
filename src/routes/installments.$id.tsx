import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { notice } from "@/lib/notice";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Guard } from "@/components/guard";
import {
  Divider,
  Empty,
  Field,
  PrimaryButton,
  RowsSkeleton,
  Screen,
  StickyBar,
  TopBar,
  inputClass,
} from "@/components/kit";
import { useAuth } from "@/lib/auth";
import { fullStamp, money } from "@/lib/format";
import { balanceOf, useAddDeposit, useInstallments } from "@/lib/queries";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";

export const Route = createFileRoute("/installments/$id")({
  head: () => ({
    meta: [
      { title: "customer" },
      { name: "description", content: "deposits made so far and the balance left to clear." },
      { property: "og:title", content: "customer" },
      {
        property: "og:description",
        content: "deposits made so far and the balance left to clear.",
      },
    ],
  }),
  component: () => (
    <Guard>
      <InstallmentPage />
    </Guard>
  ),
});

function InstallmentPage() {
  const { id } = Route.useParams();
  const { session, profile } = useAuth();
  const { data = [], isLoading } = useInstallments();
  const add = useAddDeposit();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "mpesa">("cash");

  const item = data.find((i) => i.id === id);
  if (isLoading) return <RowsSkeleton />;
  if (!item) return <Empty text="this record is missing." />;
  const balance = balanceOf(item);

  const submit = async () => {
    if (!session?.user.id || !Number(amount)) return;
    const paid = Number(amount);
    try {
      await add.mutateAsync({
        installment_id: item.id,
        amount: paid,
        method,
        recorded_by: session.user.id,
        recorded_by_name: profile?.name ?? "",
      });
      const left = balance - paid;
      setAmount("");
      setOpen(false);
      notice.ok("deposit added", {
        label: "receipt",
        run: () =>
          downloadReceiptPdf({
            heading: "payment",
            number: item.sales?.receipt_no ?? item.customer_name.toLowerCase(),
            stamp: fullStamp(new Date().toISOString()),
            lines: [
              {
                name: item.sales?.product_name ?? "installment",
                note: `${method} · ${item.customer_name.toLowerCase()}`,
                amount: money(paid),
              },
            ],
            totals: [
              { label: "item total", value: money(item.total) },
              { label: "paid now", value: money(paid) },
              { label: "remaining", value: money(Math.max(left, 0)), strong: true },
            ],
            footer: left > 0 ? "thank you, keep this receipt." : "cleared in full. thank you.",
          }),
      });
    } catch (err) {
      notice.from(err, "could not add the deposit");
    }
  };

  return (
    <Screen>
      <TopBar back title={item.customer_name.toLowerCase()} />
      <section className="px-4 py-6">
        <p className="text-xs text-muted-foreground">remaining</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{money(balance)}</p>
        <p className="mt-1 text-sm text-muted-foreground">of {money(item.total)}</p>
      </section>
      <Divider />

      {item.sales ? (
        <>
          <div className="flex items-center px-4 py-3.5">
            <span className="flex-1 text-sm text-muted-foreground">item</span>
            <span className="text-[15px]">{item.sales.product_name.toLowerCase()}</span>
          </div>
          <Divider />
        </>
      ) : null}
      {item.customer_phone ? (
        <>
          <div className="flex items-center px-4 py-3.5">
            <span className="flex-1 text-sm text-muted-foreground">phone</span>
            <a href={`tel:${item.customer_phone}`} className="text-[15px]">
              {item.customer_phone}
            </a>
          </div>
          <Divider />
        </>
      ) : null}
      <p className="px-4 pb-2 pt-6 text-xs text-muted-foreground">payments</p>
      <Divider />
      <div className="flex items-center px-4 py-3.5">
        <span className="flex-1 text-[15px]">deposit</span>
        <span className="text-[15px]">{money(item.deposit)}</span>
      </div>
      <Divider />
      {item.installment_payments.map((p) => (
        <div key={p.id}>
          <div className="flex items-center px-4 py-3.5">
            <div className="flex-1">
              <p className="text-[15px]">{p.method}</p>
              <p className="text-xs text-muted-foreground">{fullStamp(p.paid_at)}</p>
            </div>
            <span className="text-[15px]">{money(p.amount)}</span>
          </div>
          <Divider />
        </div>
      ))}
      <div className="h-16" />
      {balance > 0 ? (
        <StickyBar>
          <PrimaryButton onClick={() => setOpen(true)}>add a deposit</PrimaryButton>
        </StickyBar>
      ) : null}

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="border-0">
          <DrawerTitle className="sr-only">add a deposit</DrawerTitle>
          <Field label="amount" hint={`balance ${money(balance)}`}>
            <input
              className={inputClass}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
            />
          </Field>
          <Divider />
          <div className="flex gap-2 px-4 py-3">
            {(["cash", "mpesa"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`press flex-1 rounded-lg px-3 py-3 text-sm ${
                  method === m ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <StickyBar>
            <PrimaryButton
              disabled={!Number(amount) || add.isPending}
              onClick={() => void submit()}
            >
              {add.isPending ? "saving…" : "save deposit"}
            </PrimaryButton>
          </StickyBar>
        </DrawerContent>
      </Drawer>
    </Screen>
  );
}
