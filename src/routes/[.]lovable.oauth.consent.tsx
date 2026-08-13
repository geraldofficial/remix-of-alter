import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GhostButton, PrimaryButton, Screen, TopBar } from "@/components/kit";

type OauthDetails = {
  client?: { name?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OauthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OauthDetails | null; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OauthDetails | null; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OauthDetails | null; error: Error | null }>;
};

/** the oauth namespace is still beta in the client types */
const oauth = () => (supabase.auth as unknown as { oauth: OauthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // the session lives in the browser, so this screen never renders on the server
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <Screen>
      <TopBar backTo="/" title="connect an app" />
      <p className="px-4 py-8 text-sm text-muted-foreground">
        this request could not be loaded: {String((error as Error)?.message ?? error)}
      </p>
    </Screen>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? "an app";

  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("the sign-in service did not say where to go next.");
      return;
    }
    window.location.href = target;
  };

  return (
    <Screen>
      <TopBar backTo="/" title="connect an app" />
      <section className="mx-auto max-w-md px-4 py-8">
        <h2 className="text-xl font-semibold tracking-tight">connect {name.toLowerCase()}?</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {name.toLowerCase()} will be able to read your shop&apos;s products, categories, sales and
          installments as you, using the same access you have in this app.
        </p>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-7 space-y-2">
          <PrimaryButton disabled={busy} onClick={() => void decide(true)}>
            {busy ? "please wait…" : "allow"}
          </PrimaryButton>
          <GhostButton disabled={busy} onClick={() => void decide(false)}>
            do not allow
          </GhostButton>
        </div>
      </section>
    </Screen>
  );
}
