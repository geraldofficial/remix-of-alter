UPDATE public.sales s
SET shop_id = c.shop_id
FROM public.products p
JOIN public.categories c ON c.id = p.category_id
WHERE s.shop_id IS NULL AND p.id = s.product_id AND c.shop_id IS NOT NULL;

UPDATE public.sales s
SET shop_id = (SELECT id FROM public.shops LIMIT 1)
WHERE s.shop_id IS NULL AND (SELECT count(*) FROM public.shops) = 1;