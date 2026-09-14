"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fromIsoDate, type IsoDate } from "@/lib/date";
import { prepareImage } from "@/lib/image";
import { deletePhoto, fetchPhotos, uploadPhoto, type PhotoWithUrl } from "@/lib/progress";
import { ErrorNote } from "@/components/ErrorNote";
import { Icon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

/**
 * Private progress photos. They live in a private Supabase Storage bucket under
 * a folder named after your user id; storage policies stop your partner from
 * listing, opening or deleting them. They're shown through one-hour signed URLs
 * and never sent to the AI.
 */
export function PhotosCard({ userId, today }: { userId: string; today: IsoDate }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [photos, setPhotos] = useState<PhotoWithUrl[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<PhotoWithUrl | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setPhotos(await fetchPhotos()), []);

  useEffect(() => {
    load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load photos."));
  }, [load]);

  async function add(file: File | undefined): Promise<void> {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const image = await prepareImage(file, 2048);
      await uploadPhoto(userId, today, image.base64, null);
      await load();
      toast({ message: "Photo added" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That photo didn't upload.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section aria-labelledby="photos-heading">
      <div className="mb-2 mt-6 flex items-baseline justify-between gap-2 px-1">
        <h2 id="photos-heading" className="t-label">
          Progress photos
        </h2>
        <span className="t-meta">Only you can see these</span>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void add(e.target.files?.[0])} />
      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      <ul className="grid grid-cols-3 gap-2">
        <li>
          <button
            type="button"
            className="grid w-full place-items-center gap-1 rounded-field text-[13px] font-semibold"
            style={{ aspectRatio: "3 / 4", background: "var(--pine-wash)", color: "var(--pine)", border: "1.5px dashed var(--pine-soft)" }}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <span className="grid justify-items-center gap-1">
              <Icon name={busy ? "sparkle" : "camera"} size={24} />
              {busy ? "Uploading…" : "Add photo"}
            </span>
          </button>
        </li>
        {(photos ?? []).map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="block w-full overflow-hidden rounded-field"
              style={{ aspectRatio: "3 / 4", background: "var(--line)" }}
              onClick={() => {
                setOpen(p);
                setConfirmDelete(false);
              }}
              aria-label={`Progress photo from ${fromIsoDate(p.taken_on).toLocaleDateString()}`}
            >
              {p.url && (
                // A signed, expiring URL: next/image can't optimise or cache it, and shouldn't.
                <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
            </button>
            <p className="t-meta mt-1 text-center">{fromIsoDate(p.taken_on).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
          </li>
        ))}
      </ul>
      {photos && photos.length === 0 && <p className="t-meta mt-2 px-1">Same place, same light, every few weeks.</p>}

      <Sheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? fromIsoDate(open.taken_on).toLocaleDateString(undefined, { dateStyle: "medium" }) : ""}
      >
        {open && (
          <>
            {open.url && <img src={open.url} alt="" className="mx-auto max-h-[60dvh] rounded-field object-contain" />}
            {confirmDelete ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ background: "var(--tomato)", color: "var(--on-pine)" }}
                  onClick={() =>
                    void deletePhoto(open)
                      .then(() => {
                        setOpen(null);
                        toast({ message: "Photo deleted" });
                        return load();
                      })
                      .catch((c: unknown) => toast({ message: c instanceof Error ? c.message : "That didn't delete." }))
                  }
                >
                  Delete for good
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-quiet mt-4 w-full" style={{ color: "var(--tomato)" }} onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size={18} />
                Delete photo
              </button>
            )}
          </>
        )}
      </Sheet>
    </section>
  );
}
