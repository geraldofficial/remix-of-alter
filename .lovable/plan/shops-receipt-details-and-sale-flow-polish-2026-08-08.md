# Shops, receipt details, and sale-flow polish

## 1. Confirm sale button — no double submits

- Add a real confirmation step: tapping "confirm sale" asks "record this sale?" with total shown; only the second tap writes.
- Button gets proper states: full-width primary styling matching the rest of the app, a spinner + "saving…" label while writing, and disabled (plus pointer-events off) during the write and after success so a second tap can't fire.
- A submit guard flag makes repeat taps a no-op even if the button is re-rendered.

## 2. Dead ends always lead home

- Receipt page: back chevron goes to home (already), plus a "back to home" action at the bottom of the receipt.
- Add-item / edit-item screens: back chevron and the post-save exit both land on a real screen (items list for edit, home for the final add step) instead of unwinding steps.
- Same treatment for the "item gone" and "receipt missing" empty states.

## 3. Shop details on the receipt

Admin can set, per shop: shop name, phone number, and an optional short footer line. These appear at the top of the receipt (name + phone) and in the shared/printed PDF.

## 4. Multiple shops

- Admin creates shops from a new "shops" screen in the dashboard.
- Each category belongs to one shop. An item's shop follows its category.
- When a sale is recorded, the shop is stamped on the sale row, so history stays correct even if a category later moves.
- Money screen and stats gain a shop switcher: "all shops" plus one entry per shop. Totals, receipts, owed amounts and day closing all respect the choice.
- Items and categories screens can also be filtered by shop.
- Existing categories and past sales are attached to a first shop created from the current shop details, so nothing disappears.

## 5. Editing an item shows its current photos

The photos step in edit mode lists the item's existing images first (with remove and "show first" actions), then any newly added ones.

## Technical notes

- New `shops` table (name, phone, footer, created_at) with admin-only write, approved-read policies and grants.
- `categories.shop_id` and `sales.shop_id` columns; a migration creates a default shop and backfills both.
- `day_closures` gains `shop_id` so closing a day is per shop.
- Receipt rendering reads the shop from the sale's `shop_id`.
- Sale writes resolve `shop_id` from the product's category before insert; the offline queue payload carries it too.
- Product form takes existing `product_media` rows into local state so removal uses the existing delete-media mutation.
