import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "sales_summary",
  title: "Sales summary",
  description:
    "Summarise sales for a single day: how many sales, the money taken, and each receipt line. Defaults to today.",
  inputSchema: {
    day: z.string().trim().optional().describe("Day to summarise as YYYY-MM-DD. Defaults to today."),
    shop_id: z.string().trim().optional().describe("Limit the summary to one shop id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ day, shop_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const target = /^\d{4}-\d{2}-\d{2}$/.test(day ?? "")
      ? day!
      : new Date().toISOString().slice(0, 10);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("sales")
      .select("id, receipt_no, product_name, variant, sold_price, method, sold_at, sold_by_name, shop_id")
      .gte("sold_at", `${target}T00:00:00.000Z`)
      .lt("sold_at", `${target}T23:59:59.999Z`)
      .order("sold_at", { ascending: false })
      .limit(200);
    if (shop_id) query = query.eq("shop_id", shop_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const sales = data ?? [];
    const summary = {
      day: target,
      shop_id: shop_id ?? null,
      sale_count: sales.length,
      total: sales.reduce((sum, s) => sum + Number(s.sold_price), 0),
      sales,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
