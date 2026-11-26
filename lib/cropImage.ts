/**
 * Small, dependency-free helpers for the profile/hero image cropper.
 * `CropArea` is the pixel rectangle react-easy-crop hands to `onCropComplete`.
 */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Load an image from a URL, data URL, File or Blob (object URLs are revoked). */
export function createImage(source: string | Blob, crossOrigin: boolean | string = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("Images are not available on the server"));
      return;
    }
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    const cleanup = () => {
      if (url !== source) URL.revokeObjectURL(url);
    };
    const image = new Image();
    if (crossOrigin) image.crossOrigin = typeof crossOrigin === "string" ? crossOrigin : "anonymous";
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("Could not load the image"));
    };
    image.src = url;
  });
}

export function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });
}

/** Crop a square out of `imageSrc` and return it as a File ready to upload. */
export async function getCroppedImg(imageSrc: string, crop: CropArea): Promise<File | null> {
  if (typeof document === "undefined") return null;
  const image = await createImage(imageSrc, false);
  const size = Math.max(1, Math.round(Math.min(crop.width, crop.height)));

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, size, size);

  const blob = (await canvasBlob(canvas, "image/webp", 0.92)) ?? (await canvasBlob(canvas, "image/png"));
  if (!blob) return null;
  return new File([blob], "cropped.webp", { type: blob.type || "image/webp" });
}
