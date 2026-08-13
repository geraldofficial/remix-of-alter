import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { cachedUrl } from "@/lib/image-cache";
import { forgetBroken, loadMedia, thumbPathOf } from "@/lib/media";
import { cn } from "@/lib/utils";

export function Media({
  path,
  kind = "image",
  className,
  alt,
  thumb = false,
  previewUrl,
  priority = false,
}: {
  path: string | undefined;
  kind?: string;
  className?: string;
  alt: string;
  /** ask for the small twin first — grids load far faster with it */
  thumb?: boolean;
  /** a local file preview shown while the upload finishes in the background */
  previewUrl?: string;
  /** the first pictures on screen load right away instead of lazily */
  priority?: boolean;
}) {
  /**
   * 0 — try the small twin, then the full picture
   * 1 — the saved copy or link went bad: forget it and ask for the full picture again
   * 2 — the picture really is not there: show the quiet placeholder, never a broken icon
   */
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [path]);

  const candidates =
    path && !previewUrl && attempt < 2
      ? thumb && kind !== "video" && attempt === 0
        ? [thumbPathOf(path), path]
        : [path]
      : [];

  const held = candidates.map((c) => cachedUrl(c)).find(Boolean);

  const { data } = useQuery({
    queryKey: ["media", candidates.join("|"), kind, attempt],
    queryFn: () => loadMedia(candidates, kind),
    enabled: candidates.length > 0 && !held,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
  });

  const url = previewUrl ?? held ?? data;

  const placeholder = (
    <div
      className={cn("flex aspect-square w-full items-center justify-center bg-secondary", className)}
    >
      <ImageOff size={26} className="text-muted-foreground" strokeWidth={1.4} />
    </div>
  );

  if ((!path && !previewUrl) || attempt >= 2) return placeholder;

  if (!url)
    return <div className={cn("aspect-square w-full animate-pulse bg-secondary", className)} />;

  /** a saved copy or a signed link can go stale: drop it and ask once more */
  const retry = () => {
    if (path && !previewUrl) void forgetBroken(attempt === 0 ? [thumbPathOf(path), path] : [path]);
    setAttempt((a) => a + 1);
  };

  if (kind === "video")
    return (
      <video
        src={url}
        className={cn("w-full", className)}
        playsInline
        muted
        loop
        controls
        preload="metadata"
        onError={retry}
      />
    );

  return (
    <img
      src={url}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn("block w-full", className)}
      onError={retry}
    />
  );
}
