import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8,32}$/, "that verification code does not look right"),
});

export type VerifyResult =
  | { ok: false }
  | {
      ok: true;
      receipt_no: string;
      sold_at: string;
      total: number;
      items: { name: string; variant: string | null; amount: number }[];
      served_by: string | null;
      shop: { name: string; phone: string | null } | null;
    };

/**
 * Checks a receipt straight against the shop's books. The code is created by the
 * database when the sale is recorded, so a made-up receipt cannot pass this check.
 * Only the details already printed on the receipt come back — no customer records.
 */
export const verifyReceipt = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<VerifyResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("sales")
      .select("receipt_no, sold_at, sold_price, product_name, variant, sold_by_name, shop_id")
      .eq("verify_code", data.code)
      .order("sold_at", { ascending: true });

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { ok: false };

    const first = rows[0]!;
    let shop: { name: string; phone: string | null } | null = null;
    if (first.shop_id) {
      const { data: shopRow } = await supabaseAdmin
        .from("shops")
        .select("name, phone")
        .eq("id", first.shop_id)
        .maybeSingle();
      shop = shopRow ?? null;
    }

    return {
      ok: true,
      receipt_no: first.receipt_no,
      sold_at: first.sold_at,
      total: rows.reduce((sum, r) => sum + Number(r.sold_price), 0),
      items: rows.map((r) => ({
        name: r.product_name,
        variant: r.variant,
        amount: Number(r.sold_price),
      })),
      served_by: first.sold_by_name ?? null,
      shop,
    };
  });
