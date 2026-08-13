import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import { notice } from "@/lib/notice";
import {
  Field,
  GhostButton,
  PinInput,
  PrimaryButton,
  Screen,
  TopBar,
  inputClass,
} from "@/components/kit";
import { signInWithPin, signUpWithPin, useAuth } from "@/lib/auth";
import { hasDeviceUnlock, unlockWithDevice } from "@/lib/webauthn";

/** only same-origin relative paths may be returned to after signing in */
const safeNext = (value: unknown) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : undefined;

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => {
    const next = safeNext(s["next"]);
    return next ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign In — Touch n Trade Shop App" },
      { name: "description", content: "Sign in with your phone number and PIN to record sales, manage stock and follow up installments." },
      { property: "og:title", content: "Sign In — Touch n Trade Shop App" },
      { property: "og:description", content: "Sign in with your phone number and PIN to record sales, manage stock and follow up installments." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch() as { next?: string };
  const after = next ?? "/";
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlockable, setUnlockable] = useState(false);

  useEffect(() => setUnlockable(hasDeviceUnlock()), []);
  useEffect(() => {
    if (!loading && session) void navigate({ href: after, replace: true });
  }, [loading, session, navigate, after]);

  const submit = async () => {
    if (pin.length !== 4) {
      notice.error("the pin is 4 digits");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        if (name.trim().length < 2) throw new Error("enter your name");
        await signUpWithPin(name, phone, pin);
        notice.ok("request sent, the admin will approve you");
      } else {
        await signInWithPin(phone, pin);
      }
      await navigate({ href: after, replace: true });
    } catch (err) {
      notice.from(err, "something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const biometric = async () => {
    setBusy(true);
    try {
      await unlockWithDevice();
      await navigate({ href: after, replace: true });
    } catch (err) {
      notice.from(err, "unlock failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar
        title={mode === "in" ? "sign in" : "request access"}
        srTitle="touch n trade shop sales, stock and installments"
      />
      <div className="mx-auto flex w-full max-w-md flex-col justify-center py-10">
        <p className="px-4 pb-4 text-[15px] text-muted-foreground">
          {mode === "in"
            ? "sign in with your phone number and pin to record sales, check stock and follow up installments for your shop."
            : "tell us who you are and the admin will approve you, then you can start selling, printing receipts and tracking the shop's day."}
        </p>

        {mode === "up" ? (
          <Field label="your name">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="full name"
            />
          </Field>
        ) : null}

        <Field label="phone number">
          <input
            className={inputClass}
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07…"
          />
        </Field>

        <Field label="4 digit pin" {...(mode === "up" ? { hint: "pick something you will remember" } : {})}>
          <PinInput value={pin} onChange={setPin} reveal={mode === "up"} />
        </Field>

        <div className="space-y-2 px-4 pt-5">
          <PrimaryButton onClick={() => void submit()} disabled={busy}>
            {busy ? "please wait…" : mode === "in" ? "sign in" : "request access"}
          </PrimaryButton>
          {mode === "in" && unlockable ? (
            <button
              onClick={() => void biometric()}
              disabled={busy}
              className="press flex w-full items-center justify-center gap-2 bg-transparent py-3 text-sm text-muted-foreground"
            >
              <Fingerprint size={26} strokeWidth={1.6} />
              unlock with this device
            </button>
          ) : null}
          <GhostButton onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "i am new here" : "i already have access"}
          </GhostButton>
        </div>
      </div>
    </Screen>
  );
}

