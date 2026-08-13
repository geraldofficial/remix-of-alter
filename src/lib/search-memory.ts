import { supabase } from "@/integrations/supabase/client";
import type { SmartSearchResult } from "@/lib/search.functions";

/**
 * Two small memories keep the assistant cheap:
 *  - a shared cache, so the same question is never asked twice
 *  - each person's own past searches, so their suggestions get personal
 */

const LOCAL_KEY = "search-memory-v1";

type LocalMemory = { terms: Record<string, number>; cache: Record<string, SmartSearchResult> };

const readLocal = (): LocalMemory => {
  if (typeof localStorage === "undefined") return { terms: {}, cache: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}") as Partial<LocalMemory>;
    return { terms: parsed.terms ?? {}, cache: parsed.cache ?? {} };
  } catch {
    return { terms: {}, cache: {} };
  }
};

const writeLocal = (mem: LocalMemory) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(mem));
  } catch {
    /* ignore quota errors */
  }
};

export const normaliseTerm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

export const localTerms = () =>
  Object.entries(readLocal().terms)
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term);

export function cachedAnswer(term: string): SmartSearchResult | undefined {
  return readLocal().cache[normaliseTerm(term)];
}

export async function lookupShared(term: string): Promise<SmartSearchResult | null> {
  const key = normaliseTerm(term);
  const local = readLocal();
  if (local.cache[key]) return local.cache[key]!;
  const { data } = await supabase
    .from("search_cache")
    .select("payload")
    .eq("term", key)
    .maybeSingle();
  const payload = data?.payload as SmartSearchResult | undefined;
  if (!payload) return null;
  local.cache[key] = payload;
  writeLocal(local);
  return payload;
}

export async function rememberAnswer(term: string, payload: SmartSearchResult) {
  const key = normaliseTerm(term);
  const local = readLocal();
  local.cache[key] = payload;
  writeLocal(local);
  await supabase.from("search_cache").upsert({ term: key, payload }, { onConflict: "term" });
}

/** Learns which words this person actually uses, so their suggestions fit them. */
export async function rememberTerm(term: string, userId: string | undefined) {
  const key = normaliseTerm(term);
  if (key.length < 2) return;
  const local = readLocal();
  local.terms[key] = (local.terms[key] ?? 0) + 1;
  writeLocal(local);
  if (!userId) return;
  const { data } = await supabase
    .from("search_terms")
    .select("id, hits")
    .eq("user_id", userId)
    .eq("term", key)
    .maybeSingle();
  if (data)
    await supabase
      .from("search_terms")
      .update({ hits: data.hits + 1, last_used: new Date().toISOString() })
      .eq("id", data.id);
  else await supabase.from("search_terms").insert({ user_id: userId, term: key });
}

export async function myTerms(userId: string | undefined): Promise<string[]> {
  if (!userId) return localTerms();
  const { data } = await supabase
    .from("search_terms")
    .select("term, hits")
    .eq("user_id", userId)
    .order("hits", { ascending: false })
    .limit(24);
  const remote = (data ?? []).map((r) => r.term);
  return Array.from(new Set([...remote, ...localTerms()]));
}
