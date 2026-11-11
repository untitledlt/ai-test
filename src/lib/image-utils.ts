export const MAX_IMAGE_DIMENSION = 1024;

export function computeResampledSize(
  width: number,
  height: number,
  maxDimension: number = MAX_IMAGE_DIMENSION,
): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const OUTPUT_MIME_TYPE = 'image/jpeg';
const OUTPUT_QUALITY = 0.9;

export async function resampleImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = computeResampledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    // JPEG has no alpha channel; fill white first so a transparent source (e.g. PNG, webp)
    // doesn't turn into a black background once re-encoded.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    // Re-encoding to a fixed format (rather than preserving file.type) is what actually
    // matters here: canvas decodes any browser-supported source format, including ones
    // some APIs reject outright (e.g. webp), and always re-emits it as a plain JPEG.
    return canvas.toDataURL(OUTPUT_MIME_TYPE, OUTPUT_QUALITY);
  } finally {
    bitmap.close();
  }
}
