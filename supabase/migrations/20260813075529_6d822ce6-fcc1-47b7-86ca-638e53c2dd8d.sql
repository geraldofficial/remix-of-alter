-- category names are per shop, not global
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS categories_shop_name_key
  ON public.categories (coalesce(shop_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- do not orphan categories or sales when a shop is removed
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_shop_id_fkey;
ALTER TABLE public.categories ADD CONSTRAINT categories_shop_id_fkey
  FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE RESTRICT;

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_shop_id_fkey;
ALTER TABLE public.sales ADD CONSTRAINT sales_shop_id_fkey
  FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE RESTRICT;

-- history at scale
CREATE INDEX IF NOT EXISTS sales_shop_sold_at_idx ON public.sales (shop_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS installment_payments_paid_at_idx ON public.installment_payments (paid_at DESC);
CREATE INDEX IF NOT EXISTS product_media_product_idx ON public.product_media (product_id);