import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_categories",
  title: "List categories",
  description: "List the product categories in the account, with the shop each one belongs to.",
  inputSchema: {
    shop_id: z.string().trim().optional().describe("Limit results to one shop id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ shop_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase.from("categories").select("id, name, shop_id, shops(name)").order("name");
    if (shop_id) query = query.eq("shop_id", shop_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      shop_id: c.shop_id,
      shop: (c.shops as { name?: string } | null)?.name ?? null,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { categories: rows },
    };
  },
});
