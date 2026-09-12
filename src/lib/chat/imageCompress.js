export const IMAGE_MAX_EDGE = 1440;
export const IMAGE_JPEG_QUALITY = 0.8;
export const IMAGE_COMPRESS_THRESHOLD_BYTES = 350 * 1024;

export function computeScaledDimensions(width, height, maxEdge = IMAGE_MAX_EDGE) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const longestEdge = Math.max(safeWidth, safeHeight);

  if (longestEdge <= maxEdge) {
    return {
      width: safeWidth,
      height: safeHeight,
      scale: 1,
    };
  }

  const scale = maxEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
    scale,
  };
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image'));
    image.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function canvasToDataUrl(canvas, mimeType, quality) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/webp') {
    return canvas.toDataURL(mimeType, quality);
  }
  return canvas.toDataURL(mimeType);
}

export async function compressImageFile(file, { maxEdge = IMAGE_MAX_EDGE, quality = IMAGE_JPEG_QUALITY } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return readFileAsDataUrl(file);
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(originalDataUrl);
  const { width, height, scale } = computeScaledDimensions(image.width, image.height, maxEdge);
  const shouldResize = scale < 1;
  const shouldReencode =
    shouldResize || file.size >= IMAGE_COMPRESS_THRESHOLD_BYTES || !/^image\/(jpe?g|webp)$/i.test(file.type || '');

  if (!shouldReencode && file.size < IMAGE_COMPRESS_THRESHOLD_BYTES) {
    return originalDataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);

  const outputMimeType = file.type === 'image/png' && !shouldResize ? 'image/png' : 'image/jpeg';
  return canvasToDataUrl(canvas, outputMimeType, quality);
}
