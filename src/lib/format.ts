export const money = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0);
  return `ksh ${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
};

export const shortTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const yesterday = new Date(today.getTime() - 86400000);
  if (same) return "today";
  if (d.toDateString() === yesterday.toDateString()) return "yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export const fullStamp = (iso: string) => `${dayLabel(iso)}, ${shortTime(iso)}`;

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export const normalisePhone = (raw: string) => raw.replace(/[^\d+]/g, "");

export const deviceInfo = () => {
  if (typeof navigator === "undefined") return "unknown device";
  const ua = navigator.userAgent;
  const platform = /android/i.test(ua)
    ? "android"
    : /iphone|ipad/i.test(ua)
      ? "ios"
      : /mac/i.test(ua)
        ? "mac"
        : /win/i.test(ua)
          ? "windows"
          : "web";
  return `${platform} · ${navigator.language}`;
};
