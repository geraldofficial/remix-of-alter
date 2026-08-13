import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { notice } from "@/lib/notice";
import { supabase } from "@/integrations/supabase/client";
import { enqueueSale, flushQueue, looksOffline, onQueueChange, queuedCount } from "./offline-queue";
import { startOfToday } from "./format";

export type Category = { id: string; name: string; shop_id: string | null };
export type Shop = {
  id: string;
  name: string;
  phone: string | null;
  footer: string | null;
  created_at: string;
};
export type MediaRow = {
  id: string;
  product_id: string;
  url: string;
  kind: string;
  position: number;
};
export type Product = {
  id: string;
  name: string;
  category_id: string | null;
  base_price: number;
  stock: number;
  variants: string[];
  notes: string | null;
  created_at: string;
  product_media: MediaRow[];
};
export type Sale = {
  id: string;
  receipt_no: string;
  group_id: string | null;
  product_id: string | null;
  product_name: string;
  variant: string | null;
  sold_price: number;
  base_price: number;
  method: "cash" | "mpesa" | "installment";
  sold_by: string | null;
  sold_by_name: string | null;
  sold_at: string;
  shop_id: string | null;
  /** created by the database, printed as the receipt's QR proof */
  verify_code: string;
};
export type Installment = {
  id: string;
  sale_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_note: string | null;
  total: number;
  deposit: number;
  created_at: string;
  installment_payments: {
    id: string;
    amount: number;
    paid_at: string;
    method: string;
    recorded_by_name: string | null;
  }[];
  sales?: Pick<Sale, "product_name" | "variant" | "receipt_no" | "sold_at" | "shop_id"> | null;
};
export type PersonRow = {
  id: string;
  name: string;
  phone: string;
  status: "pending" | "approved" | "denied";
  device_info: string | null;
  joined_at: string;
};

const unwrap = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
};

const PRODUCT_SELECT =
  "id,name,category_id,base_price,stock,variants,notes,created_at,product_media(id,product_id,url,kind,position)";

export const keys = {
  products: ["products"] as const,
  categories: ["categories"] as const,
  sales: ["sales"] as const,
  installments: ["installments"] as const,
  people: ["people"] as const,
  roles: ["roles"] as const,
  closures: ["closures"] as const,
  shops: ["shops"] as const,

};

export const useCategories = () =>
  useQuery({
    queryKey: keys.categories,
    queryFn: async () =>
      unwrap<Category[]>(await supabase.from("categories").select("*").order("name")),
    // categories barely change: show the saved copy at once, refresh on reconnect
    staleTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

export const useProducts = () =>
  useQuery({
    queryKey: keys.products,
    queryFn: async () =>
      unwrap<Product[]>(
        await supabase
          .from("products")
          .select(PRODUCT_SELECT)
          .order("created_at", { ascending: false }),
      ),
    /** the saved list (names, prices, photos) renders instantly, then refreshes */
    staleTime: 1000 * 60 * 5,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    retry: 2,
  });

export const useProduct = (id: string) => {
  const { data, ...rest } = useProducts();
  return { ...rest, data: data?.find((p) => p.id === id) };
};

export const useSales = () =>
  useQuery({
    queryKey: keys.sales,
    queryFn: async () =>
      unwrap<Sale[]>(
        await supabase.from("sales").select("*").order("sold_at", { ascending: false }).limit(500),
      ),
  });

export const useTodaySales = () => {
  const { data, ...rest } = useSales();
  const from = startOfToday();
  return { ...rest, data: data?.filter((s) => s.sold_at >= from) };
};

export const useInstallments = () =>
  useQuery({
    queryKey: keys.installments,
    queryFn: async () =>
      unwrap<Installment[]>(
        await supabase
          .from("installments")
          .select(
            "*, installment_payments(*), sales(product_name, variant, receipt_no, sold_at, shop_id)",
          )
          .order("created_at", { ascending: false }),
      ),
  });

export const usePeople = () =>
  useQuery({
    queryKey: keys.people,
    queryFn: async () =>
      unwrap<PersonRow[]>(
        await supabase.from("profiles").select("*").order("joined_at", { ascending: false }),
      ),
  });

export const useClosures = () =>
  useQuery({
    queryKey: keys.closures,
    queryFn: async () =>
      unwrap<{ id: string; day: string; total: number; count: number; closed_at: string }[]>(
        await supabase
          .from("day_closures")
          .select("*")
          .order("day", { ascending: false })
          .limit(60),
      ),
  });

export const balanceOf = (i: Installment) =>
  Number(i.total) -
  Number(i.deposit) -
  i.installment_payments.reduce((s, p) => s + Number(p.amount), 0);

/** Single place every mutation goes through, so caches stay in step. */
function useInvalidating<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  touch: readonly (readonly string[])[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => touch.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}

export type NewSale = {
  product_id: string | null;
  product_name: string;
  base_price: number;
  variant: string | null;
  sold_price: number;
  method: "cash" | "mpesa" | "installment";
  sold_by: string;
  sold_by_name: string;
  group_id: string;
  shop_id: string | null;
  customer?: { name: string; phone: string; note: string; deposit: number };
};

/** Pushes sales (and any installment that comes with them) to the shop's books. */
export async function sendSales(items: NewSale[]) {
  const rows = items.map(({ customer: _c, ...row }) => row);
  const inserted = unwrap<Sale[]>(await supabase.from("sales").insert(rows).select());
  const instalments = items
    .map((item, index) => ({ item, sale: inserted[index] }))
    .filter(({ item }) => item.method === "installment" && item.customer)
    .map(({ item, sale }) => ({
      sale_id: sale!.id,
      customer_name: item.customer!.name,
      customer_phone: item.customer!.phone || null,
      customer_note: item.customer!.note || null,
      total: item.sold_price,
      deposit: item.customer!.deposit,
      created_by: item.sold_by,
    }));
  if (instalments.length) {
    const res = await supabase.from("installments").insert(instalments);
    if (res.error) throw new Error(res.error.message);
  }
  return inserted;
}

/** Records a sale; if the phone has no connection the sale waits and syncs later. */
export const useRecordSales = () =>
  useInvalidating(
    async (items: NewSale[]): Promise<{ sales: Sale[]; queued: boolean }> => {
      try {
        return { sales: await sendSales(items), queued: false };
      } catch (err) {
        if (!looksOffline(err)) throw err;
        enqueueSale(items);
        return { sales: [], queued: true };
      }
    },
    [keys.sales, keys.products, keys.installments],
  );

/** Empties the waiting queue whenever the connection comes back. */
export function useSaleQueue() {
  const qc = useQueryClient();
  const [pending, setPending] = useState(() => queuedCount());

  useEffect(() => {
    const refresh = () => setPending(queuedCount());
    const sync = async () => {
      const sent = await flushQueue(sendSales);
      refresh();
      if (sent > 0) {
        notice.ok(`${sent} offline ${sent === 1 ? "sale" : "sales"} synced`);
        [keys.sales, keys.products, keys.installments].forEach((k) =>
          qc.invalidateQueries({ queryKey: k }),
        );
      }
    };
    const off = onQueueChange(refresh);
    const onOnline = () => void sync();
    void sync();
    window.addEventListener("online", onOnline);
    const timer = setInterval(() => {
      if (navigator.onLine) void sync();
    }, 30000);
    return () => {
      off();
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [qc]);

  return pending;
}

export const useAddDeposit = () =>
  useInvalidating(
    async (p: {
      installment_id: string;
      amount: number;
      method: "cash" | "mpesa";
      recorded_by: string;
      recorded_by_name: string;
    }) => {
      const res = await supabase.from("installment_payments").insert(p);
      if (res.error) throw new Error(res.error.message);
    },
    [keys.installments],
  );

export const useSaveProduct = () =>
  useInvalidating(
    async (p: {
      id?: string;
      name: string;
      category_id: string | null;
      base_price: number;
      stock: number;
      variants: string[];
      notes: string | null;
      media?: { url: string; kind: string; position: number }[];
    }) => {
      const { media, id, ...fields } = p;
      const rows = id
        ? unwrap<Product[]>(await supabase.from("products").update(fields).eq("id", id).select())
        : unwrap<Product[]>(await supabase.from("products").insert(fields).select());
      const row = rows[0];
      if (!row) throw new Error("could not save the product");
      if (media?.length) {
        const res = await supabase
          .from("product_media")
          .insert(media.map((m) => ({ ...m, product_id: row.id })));
        if (res.error) throw new Error(res.error.message);
      }
      return row;
    },
    [keys.products],
  );

export const useDeleteProducts = () =>
  useInvalidating(
    async (ids: string[]) => {
      const res = await supabase.from("products").delete().in("id", ids);
      if (res.error) throw new Error(res.error.message);
    },
    [keys.products],
  );

export const useDeleteMedia = () =>
  useInvalidating(
    async (id: string) => {
      const res = await supabase.from("product_media").delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
    },
    [keys.products],
  );

/** Keeps the order photos are shown in, so the first one is the cover. */
export const useReorderMedia = () =>
  useInvalidating(
    async (ids: string[]) => {
      for (const [position, id] of ids.entries()) {
        const res = await supabase.from("product_media").update({ position }).eq("id", id);
        if (res.error) throw new Error(res.error.message);
      }
    },
    [keys.products],
  );


export const useSaveCategory = () =>
  useInvalidating(
    async (p: { id?: string; name: string; shop_id?: string | null }) => {
      const fields = { name: p.name, ...(p.shop_id !== undefined ? { shop_id: p.shop_id } : {}) };
      const res = p.id
        ? await supabase.from("categories").update(fields).eq("id", p.id)
        : await supabase.from("categories").insert(fields);
      if (res.error) throw new Error(res.error.message);
    },
    [keys.categories, keys.products],
  );

/** Shops: the admin can run several, each with its own categories and books. */
export const useShops = () =>
  useQuery({
    queryKey: keys.shops,
    queryFn: async () =>
      unwrap<Shop[]>(await supabase.from("shops").select("*").order("created_at")),
    staleTime: 1000 * 60 * 30,
    refetchOnReconnect: true,
  });

export const useSaveShop = () =>
  useInvalidating(
    async (p: { id?: string; name: string; phone: string | null; footer: string | null }) => {
      const { id, ...fields } = p;
      const res = id
        ? await supabase.from("shops").update(fields).eq("id", id)
        : await supabase.from("shops").insert(fields);
      if (res.error) throw new Error(res.error.message);
    },
    [keys.shops],
  );

export const useDeleteShop = () =>
  useInvalidating(
    async (id: string) => {
      const res = await supabase.from("shops").delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
    },
    [keys.shops, keys.categories, keys.products, keys.sales],
  );


export const useDeleteCategory = () =>
  useInvalidating(
    async (id: string) => {
      const res = await supabase.from("categories").delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
    },
    [keys.categories, keys.products],
  );

export const useSetPersonStatus = () =>
  useInvalidating(
    async (p: { id: string; status: "approved" | "denied" | "pending" }) => {
      const res = await supabase.from("profiles").update({ status: p.status }).eq("id", p.id);
      if (res.error) throw new Error(res.error.message);
    },
    [keys.people],
  );

export const useRoles = () =>
  useQuery({
    queryKey: keys.roles,
    queryFn: async () =>
      unwrap<{ user_id: string; role: "admin" | "staff" }[]>(
        await supabase.from("user_roles").select("user_id, role"),
      ),
  });

/** Admins hand out the role; one role per person keeps dashboards unambiguous. */
export const useSetPersonRole = () =>
  useInvalidating(
    async (p: { id: string; role: "admin" | "staff" }) => {
      const wipe = await supabase.from("user_roles").delete().eq("user_id", p.id);
      if (wipe.error) throw new Error(wipe.error.message);
      const res = await supabase.from("user_roles").insert({ user_id: p.id, role: p.role });
      if (res.error) throw new Error(res.error.message);
    },
    [keys.people, keys.roles],
  );


export const useCloseDay = () =>
  useInvalidating(
    async (p: {
      day: string;
      total: number;
      count: number;
      closed_by: string;
      shop_id: string | null;
    }) => {
      const res = await supabase.from("day_closures").upsert(p, { onConflict: "day,shop_key" });
      if (res.error) throw new Error(res.error.message);
    },
    [keys.closures],
  );

export const useUpdateSale = () =>
  useInvalidating(
    async (p: { id: string; sold_price: number; method: "cash" | "mpesa" | "installment" }) => {
      const res = await supabase
        .from("sales")
        .update({ sold_price: p.sold_price, method: p.method })
        .eq("id", p.id);
      if (res.error) throw new Error(res.error.message);
    },
    [keys.sales],
  );

export const useDeleteSale = () =>
  useInvalidating(
    async (id: string) => {
      const res = await supabase.from("sales").delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
    },
    [keys.sales, keys.installments],
  );
