import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "check_receipt",
  title: "Check a receipt",
  description:
    "Check whether a receipt is genuine using the verification code printed on it, and show the items and total recorded for that sale.",
  inputSchema: {
    code: z.string().trim().describe("The verification code printed on the receipt."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ code }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("sales")
      .select("receipt_no, product_name, variant, sold_price, sold_at, sold_by_name, shops(name, phone)")
      .eq("verify_code", code.toUpperCase())
      .order("sold_at");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data || data.length === 0) {
      const miss = { ok: false, code: code.toUpperCase() };
      return {
        content: [{ type: "text", text: "no sale in the books carries this code." }],
        structuredContent: miss,
      };
    }
    const first = data[0]!;
    const result = {
      ok: true,
      code: code.toUpperCase(),
      receipt_no: first.receipt_no,
      sold_at: first.sold_at,
      served_by: first.sold_by_name,
      shop: first.shops as { name?: string; phone?: string | null } | null,
      items: data.map((s) => ({
        name: s.product_name,
        variant: s.variant,
        amount: Number(s.sold_price),
      })),
      total: data.reduce((sum, s) => sum + Number(s.sold_price), 0),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
