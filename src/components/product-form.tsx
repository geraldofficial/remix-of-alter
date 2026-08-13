import { useEffect, useRef, useState } from "react";
import { notice } from "@/lib/notice";
import { askText } from "@/lib/dialog";

import {
  Field,
  GhostButton,
  PrimaryButton,
  StickyBar,
  inputClass,
} from "@/components/kit";
import { Media } from "@/components/media";
import { prepareMedia } from "@/lib/media";
import { cancelUpload, queueUpload } from "@/lib/upload-queue";
import {
  useCategories,
  useDeleteMedia,
  useReorderMedia,
  useSaveCategory,
  useSaveProduct,
  useShops,
  type Product,
} from "@/lib/queries";

type Shot = {
  key: string;
  preview: string;
  kind: string;
  /** the name the photo will keep; known before a single byte is sent */
  path?: string;
  failed?: boolean;
  /** set when the photo is already saved with the item */
  mediaId?: string;
};

type Draft = {
  name: string;
  category_id: string | null;
  base_price: string;
  stock: string;
  variants: string;
  notes: string;
};

const STEPS = ["what is it", "category", "price and stock", "variants", "photos"] as const;

export function ProductForm({ product, onDone }: { product?: Product; onDone: () => void }) {
  const { data: categories = [] } = useCategories();
  const { data: shops = [] } = useShops();
  const saveProduct = useSaveProduct();
  const saveCategory = useSaveCategory();
  const deleteMedia = useDeleteMedia();
  const reorderMedia = useReorderMedia();
  const [step, setStep] = useState(0);
  /** photos already saved with the item come first, so they can be seen and changed */
  const [shots, setShots] = useState<Shot[]>(() =>
    [...(product?.product_media ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ key: m.id, preview: "", kind: m.kind, path: m.url, mediaId: m.id })),
  );
  const [draft, setDraft] = useState<Draft>({
    name: product?.name ?? "",
    category_id: product?.category_id ?? null,
    base_price: product ? String(product.base_price) : "",
    stock: product ? String(product.stock) : "1",
    variants: product?.variants?.join(", ") ?? "",
    notes: product?.notes ?? "",
  });

  const patch = (part: Partial<Draft>) => setDraft((d) => ({ ...d, ...part }));
  const preparing = shots.filter((s) => !s.path && !s.failed).length;
  const failed = shots.filter((s) => s.failed).length;

  /** the camera option is only offered on phones that actually have one */
  const [hasCamera, setHasCamera] = useState(false);
  useEffect(() => {
    setHasCamera(
      typeof navigator !== "undefined" &&
        (navigator.maxTouchPoints > 0 || /android|iphone|ipad/i.test(navigator.userAgent)),
    );
  }, []);

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  /** previews are released when the form closes so long sessions stay light */
  const live = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of live.current) URL.revokeObjectURL(url);
    },
    [],
  );

  /**
   * Photos appear at once and are handed to the background uploader, so the item
   * can be saved right away and the pictures finish on their own — even if the
   * app is closed or the line drops halfway.
   */
  const pick = (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of [...files]) {
      const key = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      live.current.push(preview);
      const kind = file.type.startsWith("video") ? "video" : "image";
      setShots((prev) => [...prev, { key, preview, kind }]);
      prepareMedia(file)
        .then(async (prepared) => {
          await queueUpload(prepared);
          setShots((prev) =>
            prev.map((s) => (s.key === key ? { ...s, path: prepared.path, failed: false } : s)),
          );
        })
        .catch((err: unknown) => {
          setShots((prev) => prev.map((s) => (s.key === key ? { ...s, failed: true } : s)));
          notice.from(err, "one photo could not be added");
        });
    }
  };

  const makeDefault = (key: string) =>
    setShots((prev) => {
      const hit = prev.find((s) => s.key === key);
      if (!hit) return prev;
      const next = [hit, ...prev.filter((s) => s.key !== key)];
      const savedIds = next.filter((s) => s.mediaId).map((s) => s.mediaId!);
      if (savedIds.length > 1) void reorderMedia.mutateAsync(savedIds).catch(() => {});
      return next;
    });

  const drop = (key: string) =>
    setShots((prev) => {
      const hit = prev.find((s) => s.key === key);
      if (hit) {
        if (hit.mediaId) {
          void deleteMedia.mutateAsync(hit.mediaId).catch(() => {});
        } else {
          URL.revokeObjectURL(hit.preview);
          if (hit.path) void cancelUpload(hit.path);
        }
      }
      return prev.filter((s) => s.key !== key);
    });

  const addCategory = async () => {
    const name = (await askText("new category", { placeholder: "category name" })) ?? "";
    if (!name.trim()) return;
    await saveCategory.mutateAsync({
      name: name.trim().toLowerCase(),
      ...(shops.length === 1 ? { shop_id: shops[0]!.id } : {}),
    });
  };



  const submit = async () => {
    try {
      await saveProduct.mutateAsync({
        ...(product ? { id: product.id } : {}),
        name: draft.name.trim().toLowerCase(),
        category_id: draft.category_id,
        base_price: Number(draft.base_price || 0),
        stock: Number(draft.stock || 0),
        variants: draft.variants
          .split(",")
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean),
        notes: draft.notes.trim() || null,
        media: shots
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => s.path && !s.mediaId)
          .map(({ s, i }) => ({ url: s.path!, kind: s.kind, position: i })),
      });
      notice.ok(product ? "saved" : "item added");
      onDone();
    } catch (err) {
      notice.from(err, "could not save");
    }
  };

  const canNext =
    step === 0 ? draft.name.trim().length > 1 : step === 2 ? Number(draft.base_price) > 0 : true;
  const last = STEPS.length - 1;

  return (
    <div className="flex max-h-[88dvh] min-h-[70dvh] flex-col">
      <p className="px-4 py-3 text-xs text-muted-foreground">
        step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {step === 0 ? (
          <>
            <Field label="name">
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="item name"
                autoFocus
              />
            </Field>
            <Field label="notes">
              <input
                className={inputClass}
                value={draft.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="anything that helps searching"
              />
            </Field>
          </>
        ) : step === 1 ? (
          <div className="px-4 py-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => patch({ category_id: draft.category_id === c.id ? null : c.id })}
                  className={`press rounded-full px-3.5 py-2 text-sm ${draft.category_id === c.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                >
                  {c.name.toLowerCase()}
                </button>
              ))}
              <button
                onClick={() => void addCategory()}
                className="press rounded-full bg-secondary px-3.5 py-2 text-sm text-muted-foreground"
              >
                new category
              </button>
            </div>
          </div>
        ) : step === 2 ? (
          <>
            <Field label="base price">
              <input
                className={inputClass}
                inputMode="decimal"
                value={draft.base_price}
                onChange={(e) => patch({ base_price: e.target.value.replace(/[^\d.]/g, "") })}
                placeholder="0"
                autoFocus
              />
            </Field>
            <Field label="stock">
              <input
                className={inputClass}
                inputMode="numeric"
                value={draft.stock}
                onChange={(e) => patch({ stock: e.target.value.replace(/\D/g, "") })}
                placeholder="1"
              />
            </Field>
          </>
        ) : step === 3 ? (
          <Field label="variants" hint="separate with commas, leave empty if none">
            <input
              className={inputClass}
              value={draft.variants}
              onChange={(e) => patch({ variants: e.target.value })}
              placeholder="small, medium, large"
            />
          </Field>
        ) : (
          <div className="px-4 py-4">
            <div className={`mb-3 grid gap-2 ${hasCamera ? "grid-cols-2" : "grid-cols-1"}`}>
              {hasCamera ? (
                <label className="press relative block cursor-pointer rounded-lg bg-secondary px-4 py-4 text-center text-sm">
                  take a photo
                  <input
                    ref={cameraInput}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(e) => {
                      pick(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : null}
              <label className="press relative block cursor-pointer rounded-lg bg-secondary px-4 py-4 text-center text-sm">
                {hasCamera ? "choose from gallery" : "choose photos"}
                <input
                  ref={galleryInput}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => {
                    pick(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {preparing ? (
              <p className="mb-2 text-xs text-muted-foreground">getting {preparing} ready…</p>
            ) : failed ? (
              <p className="mb-2 text-xs text-muted-foreground">
                {failed} could not be added — remove and pick again
              </p>
            ) : shots.length ? (
              <p className="mb-2 text-xs text-muted-foreground">
                tap a photo to make it the one shown first · they finish uploading on their own
              </p>
            ) : null}

            <div className="columns-2 gap-1">
              {shots.map((s, i) => (
                <div key={s.key} className="relative mb-1 overflow-hidden rounded-lg bg-secondary">
                  <button onClick={() => makeDefault(s.key)} className="press block w-full">
                    <Media
                      previewUrl={s.preview}
                      path={s.path}
                      kind={s.kind}
                      alt="new item"
                      className="h-auto w-full object-contain"
                    />
                  </button>
                  <span className="absolute left-2 top-2 rounded-lg bg-background/80 px-2 py-1 text-xs text-muted-foreground">
                    {s.failed
                      ? "could not be added"
                      : !s.path
                        ? "getting ready…"
                        : i === 0
                          ? "shown first"
                          : "ready"}
                  </span>
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      onClick={() => drop(s.key)}
                      className="press rounded-lg bg-background/80 px-2 py-1 text-xs text-muted-foreground"
                    >
                      remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <StickyBar>
        <div className="flex gap-2">
          <GhostButton
            onClick={() => (step === 0 ? onDone() : setStep(step - 1))}
            className="w-auto flex-1"
          >
            {step === 0 ? "cancel" : "back"}
          </GhostButton>
          <PrimaryButton
            disabled={!canNext || (step === last && preparing > 0) || saveProduct.isPending}
            onClick={() => (step === last ? void submit() : setStep(step + 1))}

            className="w-auto flex-[2]"
          >
            {step === last ? (saveProduct.isPending ? "saving…" : "save item") : "next"}
          </PrimaryButton>
        </div>
      </StickyBar>
    </div>
  );
}
