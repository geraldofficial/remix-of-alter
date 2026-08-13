import { useEffect, useState } from "react";
import { useShops, type Shop } from "@/lib/queries";

const KEY = "shop-choice-v1";

/** Remembers which shop the admin was last looking at. */
export function useShopChoice() {
  const { data: shops = [] } = useShops();
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setShopId(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const choose = (next: string | null) => {
    setShopId(next);
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  };

  const valid = shopId && shops.some((s) => s.id === shopId) ? shopId : null;
  return { shops, shopId: valid, choose };
}

/** A row of shop chips; only shown once there is more than one shop. */
export function ShopPicker({
  shops,
  value,
  onChange,
  allLabel = "all shops",
}: {
  shops: Shop[];
  value: string | null;
  onChange: (next: string | null) => void;
  allLabel?: string;
}) {
  if (shops.length < 2) return null;
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3">
      {[null, ...shops.map((s) => s.id)].map((id) => {
        const label = id ? (shops.find((s) => s.id === id)?.name ?? "shop") : allLabel;
        return (
          <button
            key={id ?? "all"}
            onClick={() => onChange(id)}
            className={`press shrink-0 rounded-full px-3.5 py-2 text-sm ${
              value === id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {label.toLowerCase()}
          </button>
        );
      })}
    </div>
  );
}
