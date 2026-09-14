"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fromIsoDate, type IsoDate } from "@/lib/date";
import { prepareImage } from "@/lib/image";
import { deletePhoto, fetchPhotos, uploadPhoto, type PhotoWithUrl } from "@/lib/progress";
import { ErrorNote } from "@/components/ErrorNote";

/**
 * Private progress photos. They live in a private Supabase Storage bucket under
 * a folder named after your user id; storage policies stop your partner from
 * listing, opening or deleting them. They're shown through one-hour signed URLs
 * and never sent to the AI.
 */
export function PhotosCard({ userId, today }: { userId: string; today: IsoDate }) {
  const inputRef = useRef<HTMLInputElement>(null);
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That photo didn't upload.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="card mt-4 p-5" aria-labelledby="photos-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="photos-heading" className="font-display text-lg font-semibold">
          Progress photos
        </h2>
        <span className="text-[12px] text-muted">Only you can see these</span>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void add(e.target.files?.[0])} />
      <button type="button" className="btn btn-quiet mt-3 w-full" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? "Uploading…" : "Add a photo"}
      </button>
      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {photos && photos.length === 0 && <p className="mt-3 text-[14px] text-muted">None yet. Same place, same light, every few weeks.</p>}

      {photos && photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((p) => (
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
              <p className="mt-1 text-center text-[12px] text-muted">
                {fromIsoDate(p.taken_on).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </p>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/90 p-4" role="dialog" aria-label="Progress photo">
          <div className="flex items-center justify-between text-white">
            <span className="text-[14px]">{fromIsoDate(open.taken_on).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
            <button type="button" className="btn" style={{ color: "white" }} onClick={() => setOpen(null)} aria-label="Close">
              ✕
            </button>
          </div>
          {open.url && <img src={open.url} alt="" className="mx-auto my-4 min-h-0 flex-1 object-contain" />}
          {confirmDelete ? (
            <div className="flex gap-2">
              <button type="button" className="btn btn-quiet flex-1" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
              <button
                type="button"
                className="btn flex-1"
                style={{ background: "var(--tomato)", color: "white" }}
                onClick={() =>
                  void deletePhoto(open)
                    .then(() => {
                      setOpen(null);
                      return load();
                    })
                    .catch((c: unknown) => setError(c instanceof Error ? c.message : "That didn't delete."))
                }
              >
                Delete for good
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(true)}>
              Delete photo
            </button>
          )}
        </div>
      )}
    </section>
  );
}
