export const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'tiff',
  'avif',
]);

export const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  tiff: 'image/tiff',
  avif: 'image/avif',
};

export function isImageFile(path: string): boolean {
  return IMAGE_EXTENSIONS.has(path.split('.').pop()?.toLowerCase() ?? '');
}

export function imageDataUrl(path: string, base64: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return `data:${IMAGE_MIME[ext] ?? 'image/png'};base64,${base64}`;
}
