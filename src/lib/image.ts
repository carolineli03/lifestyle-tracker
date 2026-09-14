/**
 * Shrinking a phone photo before it leaves the device. A 12 MP camera image
 * is 3–8 MB; nutrition labels stay perfectly legible at 1568 px on the long
 * edge (the size the model works at anyway), which is a few hundred KB as JPEG.
 */

export const MAX_EDGE = 1568;

/** Scale (w, h) to fit within `max` on the long edge, never upscaling. */
export function fitWithin(width: number, height: number, max = MAX_EDGE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= max || long === 0) return { width, height };
  const scale = max / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export type PreparedImage = { base64: string; mediaType: "image/jpeg"; bytes: number };

/** Browser-only: decode, downscale, re-encode as JPEG. Throws a message fit to show. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "This browser couldn't open that photo (HEIC photos don't open in every browser). Try the camera button, or a JPEG or PNG.",
    );
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't prepare photos for upload.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't prepare that photo for upload.");

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that photo."));
    reader.readAsDataURL(blob);
  });

  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/jpeg", bytes: blob.size };
}
