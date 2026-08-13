import { useEffect, useState } from "react";

/** How much of the screen the on-screen keyboard is covering, measured live. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
    if (!vv) return;
    const measure = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      // small differences are browser chrome, not a keyboard
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    return () => {
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
    };
  }, []);

  return inset;
}

/** Height of the part of the screen the user can actually see right now. */
export function useVisibleHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const measure = () =>
      setHeight(Math.round(window.visualViewport?.height ?? window.innerHeight));
    measure();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measure);
    window.addEventListener("resize", measure);
    return () => {
      vv?.removeEventListener("resize", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return height;
}
