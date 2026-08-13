import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_products",
  title: "List products",
  description:
    "List the shop's products with stock levels, base price, variants and category. Optionally filter by name and show only items that are out of stock.",
  inputSchema: {
    search: z.string().trim().optional().describe("Filter products whose name contains this text."),
    only_out_of_stock: z
      .boolean()
      .optional()
      .describe("When true, return only products with no stock left."),
    limit: z.number().int().optional().describe("Maximum number of products to return (max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, only_out_of_stock, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("products")
      .select("id, name, stock, base_price, variants, notes, category_id, categories(name)")
      .order("name")
      .limit(Math.min(Math.max(limit ?? 50, 1), 100));
    if (search) query = query.ilike("name", `%${search}%`);
    if (only_out_of_stock) query = query.lte("stock", 0);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      base_price: Number(p.base_price),
      variants: p.variants ?? [],
      category: (p.categories as { name?: string } | null)?.name ?? null,
      notes: p.notes,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { products: rows },
    };
  },
});
