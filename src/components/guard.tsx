import { Navigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { clearPersistence } from "@/lib/persist";
import { DangerButton, GhostButton, LoadingDots, Screen } from "@/components/kit";

function Waiting({ denied, onRefresh }: { denied: boolean; onRefresh: () => void }) {
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    clearPersistence();
    await supabase.auth.signOut();
  };

  return (
    <Screen>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-8 text-center">
        <p className="text-[15px]">{denied ? "your access was declined." : "waiting for approval."}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {denied
            ? "talk to the admin if this is a mistake."
            : "the admin will let you in shortly."}
        </p>
        <div className="mt-8 w-full space-y-2">
          {denied ? null : <GhostButton onClick={onRefresh}>check again</GhostButton>}
          <DangerButton onClick={() => void signOut()}>sign out</DangerButton>
        </div>
      </div>
    </Screen>
  );
}

export function Guard({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { loading, session, profile, isAdmin, refresh } = useAuth();

  if (loading)
    return (
      <Screen>
        <div className="flex min-h-dvh items-center justify-center">
          <LoadingDots />
        </div>
      </Screen>
    );


  if (!session) return <Navigate to="/auth" replace />;

  // no profile yet, or one that is not approved: nothing of the shop is shown
  if (!profile || profile.status !== "approved")
    return <Waiting denied={profile?.status === "denied"} onRefresh={() => void refresh()} />;

  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
