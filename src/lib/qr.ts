import QRCode from "qrcode";

/** Renders a QR code as a png data url, ready for an <img> or the receipt pdf. */
export const qrDataUrl = (text: string, size = 320) =>
  QRCode.toDataURL(text, {
    margin: 1,
    width: size,
    errorCorrectionLevel: "M",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });

/** The address the QR code points at: a public page anyone can open to check a receipt. */
export const verifyUrlFor = (code: string, origin?: string) => {
  const base =
    origin ?? (typeof window === "undefined" ? "" : window.location.origin.replace(/\/$/, ""));
  return `${base}/verify/${code}`;
};
