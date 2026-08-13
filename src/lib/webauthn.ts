import { supabase } from "@/integrations/supabase/client";
import { deviceInfo } from "./format";

const LOCAL_KEY = "device-unlock-v1";

/**
 * Only a revocable Supabase refresh token is kept on the device — never the
 * phone + pin, which is the actual account password.
 */
type Stored = { credentialId: string; phone: string; refreshToken: string };

const supported = () =>
  typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;

export const canUseBiometrics = supported;

const read = (): Stored | null => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (!parsed.credentialId || !parsed.refreshToken) return null;
    return parsed as Stored;
  } catch {
    return null;
  }
};

export const hasDeviceUnlock = () => supported() && !!read();

export const storedPhone = (): string | null => read()?.phone ?? null;

const bufToB64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const b64ToBuf = (s: string) => {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Enrol this phone's fingerprint / face unlock, gating a revocable session token. */
export async function enrolDeviceUnlock(userId: string, name: string, phone: string) {
  if (!supported()) throw new Error("this device does not support biometric unlock");

  const { data: sessionData } = await supabase.auth.getSession();
  const refreshToken = sessionData.session?.refresh_token;
  if (!refreshToken) throw new Error("sign in again before setting up unlock");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "shop", id: window.location.hostname },
      user: {
        id: Uint8Array.from(userId.replace(/-/g, "").slice(0, 32), (c) => c.charCodeAt(0)),
        name: phone,
        displayName: name,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("unlock setup was cancelled");

  const credentialId = bufToB64(credential.rawId);
  localStorage.setItem(
    LOCAL_KEY,
    JSON.stringify({ credentialId, phone, refreshToken } satisfies Stored),
  );
  await supabase.from("device_credentials").insert({
    user_id: userId,
    credential_id: credentialId,
    device_info: deviceInfo(),
  });
}

/** Prompts fingerprint / face and restores the signed-in session on success. */
export async function unlockWithDevice(): Promise<void> {
  const stored = read();
  if (!stored || !supported()) throw new Error("no unlock set up on this device");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: b64ToBuf(stored.credentialId), type: "public-key" }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  if (!assertion) throw new Error("unlock failed");

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: stored.refreshToken,
  });
  if (error || !data.session) {
    localStorage.removeItem(LOCAL_KEY);
    throw new Error("unlock expired, please sign in with your pin");
  }

  // rotate the stored token so the device keeps a fresh, revocable credential
  localStorage.setItem(
    LOCAL_KEY,
    JSON.stringify({ ...stored, refreshToken: data.session.refresh_token } satisfies Stored),
  );
}

export const forgetDeviceUnlock = () => localStorage.removeItem(LOCAL_KEY);
