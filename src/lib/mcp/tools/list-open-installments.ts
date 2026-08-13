import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_open_installments",
  title: "List open installments",
  description:
    "List customers still paying in installments, with what they owe, so you can follow them up.",
  inputSchema: {
    shop_id: z.string().trim().optional().describe("Limit results to one shop id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ shop_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("installments")
      .select(
        "id, customer_name, customer_phone, total, deposit, created_at, sales(shop_id, product_name), installment_payments(amount)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? [])
      .filter((i) => {
        const sale = i.sales as { shop_id?: string | null } | null;
        return !shop_id || sale?.shop_id === shop_id;
      })
      .map((i) => {
        const paid =
          Number(i.deposit) +
          ((i.installment_payments as { amount: number }[] | null) ?? []).reduce(
            (sum, p) => sum + Number(p.amount),
            0,
          );
        return {
          id: i.id,
          customer_name: i.customer_name,
          customer_phone: i.customer_phone,
          item: (i.sales as { product_name?: string } | null)?.product_name ?? null,
          total: Number(i.total),
          paid,
          balance: Number(i.total) - paid,
          started_at: i.created_at,
        };
      })
      .filter((i) => i.balance > 0);
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { installments: rows },
    };
  },
});
