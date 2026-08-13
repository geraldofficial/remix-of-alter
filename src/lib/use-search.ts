import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { smartSearch, type SmartSearchResult } from "@/lib/search.functions";
import {
  cachedAnswer,
  lookupShared,
  myTerms,
  normaliseTerm,
  rememberAnswer,
  rememberTerm,
} from "@/lib/search-memory";
import type { Product, Category } from "@/lib/queries";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** singular/plural and common endings are treated as the same word */
const stem = (w: string) =>
  w.length > 4 ? w.replace(/(ies|es|s|ing|ed)$/, "") : w.replace(/s$/, "");

/** true when two words are one small typo apart — "shose" still finds "shoes" */
const nearly = (a: string, b: string) => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || a.length < 4) return false;
  let i = 0;
  let j = 0;
  let slips = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++slips > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return slips + (a.length - i) + (b.length - j) <= 1;
};

type Indexed = {
  p: Product;
  name: string;
  nameWords: string[];
  category: string;
  variants: string;
  notes: string;
};

const buildIndex = (products: Product[], categories: Category[]): Indexed[] =>
  products.map((p) => {
    const name = norm(p.name);
    return {
      p,
      name,
      nameWords: name.split(" ").map(stem).filter(Boolean),
      category: norm(categories.find((c) => c.id === p.category_id)?.name ?? ""),
      variants: norm(p.variants?.join(" ") ?? ""),
      notes: norm(p.notes ?? ""),
    };
  });

/** How well one typed word fits an item, and in plain words why. */
function wordScore(row: Indexed, word: string) {
  const w = stem(word);
  if (!w) return null;
  if (row.name.startsWith(word) || row.nameWords.some((n) => n.startsWith(w)))
    return { score: 8, why: "name" };
  if (row.name.includes(w)) return { score: 6, why: "name" };
  if (row.category.includes(w)) return { score: 4, why: "category" };
  if (row.variants.includes(w)) return { score: 4, why: "variant" };
  if (row.notes.includes(w)) return { score: 2, why: "details" };
  if (row.nameWords.some((n) => nearly(n, w))) return { score: 3, why: "close to the name" };
  return null;
}

export type SearchHit = { product: Product; why: string | null };

/** Forgiving local search first, model-backed search when words do not match. */
export function useProductSearch(products: Product[], categories: Category[]) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [query, setQuery] = useState("");
  const [ai, setAi] = useState<SmartSearchResult | null>(null);
  const [usedCache, setUsedCache] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const learnTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: learned = [] } = useQuery({
    queryKey: ["search-terms", userId ?? "anon"],
    queryFn: () => myTerms(userId),
    staleTime: 1000 * 60 * 10,
  });

  const askModel = useMutation({
    mutationFn: async (q: string): Promise<{ result: SmartSearchResult; cached: boolean }> => {
      const cached = await lookupShared(q);
      if (cached) return { result: cached, cached: true };
      const result = await smartSearch({
        data: {
          query: q,
          items: products.slice(0, 300).map((p) => ({
            id: p.id,
            text: `${p.name} ${p.variants?.join(" ") ?? ""} ${p.notes ?? ""}`.slice(0, 300),
          })),
        },
      });
      if (result.matches.length) await rememberAnswer(q, result);
      return { result, cached: false };
    },
    onSuccess: ({ result, cached }) => {
      setAi(result);
      setUsedCache(cached);
    },
  });

  /** searchable text is prepared once per product list, not on every keystroke */
  const index = useMemo(() => buildIndex(products, categories), [products, categories]);

  const local = useMemo(() => {
    const q = norm(query);
    if (!q) return products.map((p) => ({ product: p, why: null }) as SearchHit);
    const words = q.split(" ");
    type Scored = { row: Indexed; score: number; hit: number; reasons: string[] };
    const scored: Scored[] = [];
    for (const row of index) {
      let score = 0;
      let hit = 0;
      const reasons = new Set<string>();
      for (const word of words) {
        const res = wordScore(row, word);
        if (!res) continue;
        hit++;
        score += res.score;
        reasons.add(res.why);
      }
      if (!hit) continue;
      // items that match every typed word always beat partial matches
      score += hit === words.length ? 20 : 0;
      if (row.p.stock > 0) score += 1;
      scored.push({ row, score, hit, reasons: [...reasons] });
    }
    const full = scored.filter((s) => s.hit === words.length);
    const pool = full.length ? full : scored;
    return pool
      .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name))
      .map((x) => ({ product: x.row.p, why: `matched on ${x.reasons.join(" and ")}` }) as SearchHit);
  }, [products, index, query]);

  useEffect(() => {
    clearTimeout(timer.current);
    const q = normaliseTerm(query);
    if (q.length < 4 || local.length > 0) {
      setAi(null);
      setUsedCache(false);
      return;
    }
    // an answer already on the phone shows straight away, with nothing to wait for
    const known = cachedAnswer(q);
    if (known) {
      setAi(known);
      setUsedCache(true);
      return;
    }
    setAi(null);
    setUsedCache(false);
    timer.current = setTimeout(() => askModel.mutate(q), 450);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, local.length]);

  // remember what people actually type, once they stop typing and something matched
  useEffect(() => {
    clearTimeout(learnTimer.current);
    const q = normaliseTerm(query);
    if (q.length < 3) return;
    learnTimer.current = setTimeout(() => void rememberTerm(q, userId), 1400);
    return () => clearTimeout(learnTimer.current);
  }, [query, userId]);

  const results = useMemo<SearchHit[]>(() => {
    if (local.length > 0 || !ai) return local;
    const why = new Map(ai.matches.map((m) => [m.id, m.why]));
    const order = ai.matches.map((m) => m.id);
    return products
      .filter((p) => why.has(p.id))
      .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
      .map((p) => ({ product: p, why: why.get(p.id) ?? null }));
  }, [local, ai, products]);

  /**
   * Phrases worth trying next: the words this person uses, then the shop's own
   * categories and item names. Prefix matches lead, so typing narrows quickly.
   */
  const suggestions = useMemo(() => {
    const q = normaliseTerm(query);
    const pool = [
      ...learned,
      ...(ai?.suggestions ?? []),
      ...categories.map((c) => c.name.toLowerCase()),
      ...products.map((p) => p.name.toLowerCase()),
      ...products.flatMap((p) => p.variants ?? []),
    ];
    const seen = new Set<string>();
    const starts: string[] = [];
    const contains: string[] = [];
    const close: string[] = [];
    for (const s of pool) {
      const v = normaliseTerm(s);
      if (!v || v === q || seen.has(v)) continue;
      seen.add(v);
      if (!q) starts.push(v);
      else if (v.startsWith(q)) starts.push(v);
      else if (v.includes(q)) contains.push(v);
      else if (v.split(" ").some((w) => nearly(stem(w), stem(q)))) close.push(v);
    }
    return [...starts, ...contains, ...close].slice(0, 8);
  }, [learned, ai, categories, products, query]);

  return {
    query,
    setQuery,
    results,
    suggestions,
    aiPending: askModel.isPending,
    usedAi: local.length === 0 && (ai?.matches.length ?? 0) > 0,
    usedCache,
  };
}
