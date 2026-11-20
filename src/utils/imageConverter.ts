export interface ConvertedRadiographImage {
  dataUrl: string;
  base64Data: string;
  mimeType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode radiograph to base64.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read radiograph file.'));
    reader.readAsDataURL(blob);
  });
}

function measureImageDimensions(srcUrl: string): Promise<{ width: number; height: number; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        reject(new Error('Uploaded image has invalid dimensions.'));
        return;
      }
      resolve({ width, height, img });
    };
    img.onerror = () =>
      reject(
        new Error('Could not decode uploaded image. Please upload a valid .jpg or .png radiograph.')
      );
    img.src = srcUrl;
  });
}

/**
 * Converts uploaded radiographs to clean base64 JPEG/PNG WITHOUT downscaling or
 * lossy canvas recompression so microthreads and apical flutes retain 100% native pixel density.
 */
export async function convertImageToCleanBase64(
  source: Blob,
  fileName?: string
): Promise<ConvertedRadiographImage> {
  const mimeLower = source.type.toLowerCase();
  const isNativeJpeg =
    mimeLower === 'image/jpeg' ||
    mimeLower === 'image/jpg' ||
    (!mimeLower && Boolean(fileName && /\.jpe?g$/i.test(fileName)));
  const isNativePng =
    mimeLower === 'image/png' ||
    (!mimeLower && Boolean(fileName && /\.png$/i.test(fileName)));

  // Fast lossless path: preserve exact original JPEG/PNG bytes with zero canvas downscaling or recompression
  if (isNativeJpeg || isNativePng) {
    const targetMime: 'image/jpeg' | 'image/png' = isNativePng ? 'image/png' : 'image/jpeg';
    const rawDataUrl = await readBlobAsDataUrl(source);
    const commaIdx = rawDataUrl.indexOf(',');
    if (commaIdx === -1) {
      throw new Error('Failed to encode radiograph image to base64.');
    }
    const base64Data = rawDataUrl.slice(commaIdx + 1);
    const normalizedDataUrl = `data:${targetMime};base64,${base64Data}`;
    const { width, height } = await measureImageDimensions(normalizedDataUrl);

    return {
      dataUrl: normalizedDataUrl,
      base64Data,
      mimeType: targetMime,
      width,
      height,
    };
  }

  // Fallback for other decodable formats: preserve 100% native dimensions as lossless PNG (no downscaling)
  const objectUrl = URL.createObjectURL(source);
  try {
    const { width, height, img } = await measureImageDimensions(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser canvas context is unavailable for image conversion.');
    }
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/png');
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) {
      throw new Error('Failed to encode radiograph image to lossless PNG.');
    }
    return {
      dataUrl,
      base64Data: dataUrl.slice(commaIdx + 1),
      mimeType: 'image/png',
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Crops a single detected implant fixture from a full-resolution quadrant/full-arch radiograph
 * using normalized [ymin, xmin, ymax, xmax] (0–1000) coordinates at 100% native pixel density
 * (with a slight ~4% clinical margin so crestal collar and apex remain cleanly framed).
 */
export async function cropRadiographByBoundingBox(
  sourceDataUrl: string,
  mimeType: 'image/jpeg' | 'image/png',
  box: [number, number, number, number]
): Promise<ConvertedRadiographImage> {
  const { width, height, img } = await measureImageDimensions(sourceDataUrl);
  const [rawYmin, rawXmin, rawYmax, rawXmax] = box;

  const ymin = Math.max(0, Math.min(999, rawYmin));
  const xmin = Math.max(0, Math.min(999, rawXmin));
  const ymax = Math.max(ymin + 1, Math.min(1000, rawYmax));
  const xmax = Math.max(xmin + 1, Math.min(1000, rawXmax));

  const boxHeightNorm = ymax - ymin;
  const boxWidthNorm = xmax - xmin;
  const padY = Math.round(boxHeightNorm * 0.06);
  const padX = Math.round(boxWidthNorm * 0.08);

  const sx = Math.max(0, Math.floor(((xmin - padX) / 1000) * width));
  const sy = Math.max(0, Math.floor(((ymin - padY) / 1000) * height));
  const ex = Math.min(width, Math.ceil(((xmax + padX) / 1000) * width));
  const ey = Math.min(height, Math.ceil(((ymax + padY) / 1000) * height));

  const cropW = Math.max(16, ex - sx);
  const cropH = Math.max(16, ey - sy);

  const canvas = document.createElement('canvas');
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser canvas context is unavailable for cropping the implant fixture.');
  }
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

  const targetMime: 'image/jpeg' | 'image/png' =
    mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl =
    targetMime === 'image/png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.96);
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('Failed to encode cropped implant radiograph.');
  }

  return {
    dataUrl,
    base64Data: dataUrl.slice(commaIdx + 1),
    mimeType: targetMime,
    width: cropW,
    height: cropH,
  };
}

