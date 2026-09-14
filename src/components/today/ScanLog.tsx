"use client";

import { useEffect, useRef, useState } from "react";
import { barcodeVariants, DbBarcodeResponse, type DbFood } from "@/lib/fooddb";
import type { Draft } from "./DraftTable";

type NewDraft = Omit<Draft, "key">;

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

/**
 * Native BarcodeDetector where the browser has one (Android Chrome); the
 * zxing WebAssembly ponyfill everywhere else (iPhone Safari). The .wasm is
 * served from /zxing/, never a CDN.
 */
async function makeDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (native) {
    try {
      return new native({ formats: FORMATS });
    } catch {
      // Fall through to the ponyfill.
    }
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path) },
  });
  return new BarcodeDetector({ formats: FORMATS as never });
}

export function ScanLog({
  onDraft,
  onError,
  onUsePhoto,
  findInLibrary,
  toDraft,
}: {
  onDraft: (draft: NewDraft) => void;
  onError: (message: string | null) => void;
  onUsePhoto: () => void;
  /** A food already in the household library with this barcode, if any. */
  findInLibrary: (codes: readonly string[]) => NewDraft | null;
  toDraft: (food: DbFood) => NewDraft;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [looking, setLooking] = useState(false);
  const [typed, setTyped] = useState("");
  const [notFound, setNotFound] = useState<string | null>(null);

  function stop(): void {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  // Always release the camera when the tab closes.
  useEffect(() => stop, []);

  async function lookup(code: string): Promise<void> {
    const digits = code.replace(/\D/g, "");
    setNotFound(null);
    onError(null);
    const known = findInLibrary(barcodeVariants(digits));
    if (known) {
      onDraft({ ...known, note: `${known.note ? `${known.note} · ` : ""}From your foods (barcode ${digits})` });
      return;
    }
    setLooking(true);
    try {
      const res = await fetch(`/api/foods/barcode?code=${encodeURIComponent(digits)}`, { signal: AbortSignal.timeout(20000) });
      const body: unknown = await res.json();
      if (!res.ok) {
        onError((body as { error?: { message?: string } }).error?.message ?? `Lookup failed (HTTP ${res.status}).`);
        return;
      }
      const parsed = DbBarcodeResponse.safeParse(body);
      if (!parsed.success) {
        onError("The barcode lookup sent back something unexpected.");
        return;
      }
      if (!parsed.data.food) {
        setNotFound(digits);
        return;
      }
      onDraft(toDraft(parsed.data.food));
      setTyped("");
    } catch {
      onError("Couldn't reach the barcode lookup. Check your connection, or photo the label instead.");
    } finally {
      setLooking(false);
    }
  }

  async function start(): Promise<void> {
    onError(null);
    setNotFound(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    } catch {
      onError("The camera isn't available. Allow camera access for this site, or type the barcode number below.");
      return;
    }
    streamRef.current = stream;
    setScanning(true);

    let detector: Detector;
    try {
      detector = await makeDetector();
    } catch {
      stop();
      onError("Barcode reading isn't supported in this browser. Type the number below instead.");
      return;
    }

    const video = videoRef.current;
    if (!video) return stop();
    video.srcObject = stream;
    await video.play().catch(() => undefined);

    // Poll a few times a second; stop at the first read.
    const tick = async (): Promise<void> => {
      if (!streamRef.current) return;
      try {
        if (video.readyState >= 2) {
          const [hit] = await detector.detect(video);
          if (hit?.rawValue && /^[0-9]{6,14}$/.test(hit.rawValue)) {
            navigator.vibrate?.(40);
            stop();
            await lookup(hit.rawValue);
            return;
          }
        }
      } catch {
        // A frame that can't be read is normal; keep going.
      }
      setTimeout(() => void tick(), 250);
    };
    void tick();
  }

  return (
    <div className="mt-4">
      {scanning ? (
        <div>
          <div className="relative overflow-hidden rounded-field" style={{ background: "#000", aspectRatio: "4 / 3" }}>
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 rounded-field"
              style={{ height: "35%", border: "2px solid var(--marigold)" }}
            />
          </div>
          <p className="mt-2 text-[14px] text-muted" aria-live="polite">
            Point at the barcode and hold steady.
          </p>
          <button type="button" className="btn btn-quiet mt-2 w-full" onClick={stop}>
            Stop camera
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary w-full" onClick={() => void start()} disabled={looking}>
          {looking ? "Looking it up…" : "Scan a barcode"}
        </button>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.replace(/\D/g, "").length >= 6) void lookup(typed);
        }}
      >
        <label htmlFor="barcode-typed" className="sr-only">
          Barcode number
        </label>
        <input
          id="barcode-typed"
          className="field flex-1"
          inputMode="numeric"
          placeholder="Or type the number under the bars"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button type="submit" className="btn btn-quiet" disabled={looking || typed.replace(/\D/g, "").length < 6}>
          Look up
        </button>
      </form>

      {notFound && (
        <div className="mt-3 rounded-field p-3 text-[14px]" style={{ background: "var(--marigold-wash)" }} role="status">
          {notFound} isn&rsquo;t in the food databases yet.{" "}
          <button type="button" className="font-semibold underline" style={{ color: "var(--pine)", minHeight: 0 }} onClick={onUsePhoto}>
            Photo the label instead
          </button>
          .
        </div>
      )}

      <p className="mt-2 text-[12px] text-muted">Product data from Open Food Facts and USDA FoodData Central.</p>
    </div>
  );
}
