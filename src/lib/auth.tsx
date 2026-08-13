import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { deviceInfo, normalisePhone } from "./format";

export type Role = "admin" | "staff";
export type Profile = {
  id: string;
  name: string;
  phone: string;
  status: "pending" | "approved" | "denied";
  device_info: string | null;
  joined_at: string;
};

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  profile: null,
  role: null,
  loading: true,
  isAdmin: false,
  refresh: async () => {},
});

/** phone + pin are the only credentials; auth needs an email so we derive one. */
export const credentialsFor = (phone: string, pin: string) => ({
  email: `u${normalisePhone(phone).replace(/\D/g, "")}@shop.local`,
  password: `${normalisePhone(phone)}#${pin}`,
});

export async function signUpWithPin(name: string, phone: string, pin: string) {
  const { email, password } = credentialsFor(phone, pin);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("could not create the account");
  const { error: pErr } = await supabase.from("profiles").insert({
    id: uid,
    name: name.trim(),
    phone: normalisePhone(phone),
    device_info: deviceInfo(),
  });
  if (pErr) throw pErr;
}

export async function signInWithPin(phone: string, pin: string) {
  const { email, password } = credentialsFor(phone, pin);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("that number and pin do not match");
}

/** identity cache: the browser must not forget who this user is between loads */
const IDENTITY_KEY = "shop.identity";

type Identity = { uid: string; profile: Profile | null; role: Role | null };

const readIdentity = (uid: string | undefined): Identity | null => {
  if (!uid || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Identity;
    return parsed.uid === uid ? parsed : null;
  } catch {
    return null;
  }
};

const writeIdentity = (identity: Identity) => {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    /* storage full or blocked: we simply refetch next time */
  }
};

export const clearIdentity = () => {
  try {
    localStorage.removeItem(IDENTITY_KEY);
  } catch {
    /* nothing to do */
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      setRole(null);
      clearIdentity();
      return;
    }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
    ]);
    const nextProfile = (p as Profile) ?? null;
    const nextRole = ((r?.role as Role) ?? null) as Role | null;
    setProfile(nextProfile);
    setRole(nextRole);
    if (nextProfile || nextRole) writeIdentity({ uid, profile: nextProfile, role: nextRole });
  };

  useEffect(() => {
    let alive = true;

    const settle = async (s: Session | null) => {
      if (!alive) return;
      setSession(s);
      // nothing of the shop renders until we know the role: either from the
      // cached identity (instant) or from the database
      const cached = readIdentity(s?.user.id);
      if (cached) {
        setProfile(cached.profile);
        setRole(cached.role);
        setLoading(false);
        void load(s?.user.id);
        return;
      }
      setLoading(true);
      await load(s?.user.id);
      if (alive) setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        setSession(s);
        return;
      }
      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        clearIdentity();
        return;
      }
      void settle(s);
    });

    void supabase.auth.getSession().then(({ data }) => settle(data.session));

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);


  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      role,
      loading,
      isAdmin: role === "admin",
      refresh: () => load(session?.user.id),
    }),
    [session, profile, role, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
