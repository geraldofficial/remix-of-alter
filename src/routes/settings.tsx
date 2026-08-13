import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { notice } from "@/lib/notice";
import { Guard } from "@/components/guard";
import { Divider, Row, Screen, TopBar } from "@/components/kit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fullStamp } from "@/lib/format";
import { clearPersistence } from "@/lib/persist";
import {
  canUseBiometrics,
  enrolDeviceUnlock,
  forgetDeviceUnlock,
  hasDeviceUnlock,
} from "@/lib/webauthn";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "settings" },
      { name: "description", content: "device unlock, account details and signing out." },
      { property: "og:title", content: "settings" },
      { property: "og:description", content: "device unlock, account details and signing out." },
    ],
  }),
  component: () => (
    <Guard>
      <SettingsPage />
    </Guard>
  ),
});

function SettingsPage() {
  const { profile, role, session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const enrol = async () => {
    if (!profile || !session) return;
    try {
      await enrolDeviceUnlock(session.user.id, profile.name, profile.phone);
      notice.ok("device unlock is on");
    } catch (err) {
      notice.from(err, "could not set up unlock");
    }
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    clearPersistence();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  };

  return (
    <Screen>
      <TopBar back title="settings" />
      <div className="px-4 py-5">
        <p className="text-lg">{profile?.name?.toLowerCase()}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile?.phone} · {role ?? "staff"}
        </p>
        {profile ? (
          <p className="mt-1 text-xs text-muted-foreground">
            joined {fullStamp(profile.joined_at)}
          </p>
        ) : null}
      </div>
      <Divider />
      {canUseBiometrics() ? (
        hasDeviceUnlock() ? (
          <Row
            as="button"
            onClick={() => {
              forgetDeviceUnlock();
              notice.ok("unlock removed");
            }}
          >
            <span className="flex-1 text-[15px]">remove device unlock</span>
          </Row>
        ) : (
          <Row as="button" onClick={() => void enrol()}>
            <span className="flex-1 text-[15px]">use fingerprint or face on this phone</span>
          </Row>
        )
      ) : null}
      <Row
        as="button"
        onClick={() => {
          clearPersistence();
          void qc.invalidateQueries();
          notice.ok("cache cleared");
        }}
      >
        <span className="flex-1 text-[15px]">clear offline cache</span>
      </Row>
      <Row as="button" onClick={() => void signOut()}>
        <span className="flex-1 text-[15px] font-semibold text-destructive">sign out</span>
      </Row>

    </Screen>
  );
}
