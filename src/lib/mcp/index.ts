import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listShopsTool from "./tools/list-shops";
import listProductsTool from "./tools/list-products";
import listCategoriesTool from "./tools/list-categories";
import salesSummaryTool from "./tools/sales-summary";
import listOpenInstallmentsTool from "./tools/list-open-installments";
import checkReceiptTool from "./tools/check-receipt";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged, and Vite inlines it at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "remix-of-remix-of-remix-of-remix-of-swift-stock",
  title: "Remix of Remix of Remix of Remix of Swift Stock",
  version: "0.1.0",
  instructions:
    "Tools for a shop's sales and stock book. Use `list_shops` and `list_categories` to see how the account is set up, `list_products` for stock and prices, `sales_summary` for a day's takings, `list_open_installments` for customers still paying, and `check_receipt` to confirm a receipt is genuine. Everything is read as the signed-in staff member, so a staff account sees only what they are allowed to see.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  // exactOptionalPropertyTypes makes the SDK's tool union reject an absent
  // outputSchema, so widen the list once here.
  tools: [
    listShopsTool,
    listCategoriesTool,
    listProductsTool,
    salesSummaryTool,
    listOpenInstallmentsTool,
    checkReceiptTool,
  ] as unknown as Parameters<typeof defineMcp>[0]["tools"],
});
