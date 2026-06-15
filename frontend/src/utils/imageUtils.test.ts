import { describe, it, expect } from 'vitest';
import { isImageFile, imageDataUrl, IMAGE_MIME } from './imageUtils';

describe('isImageFile', () => {
  it('returns true for known image extensions', () => {
    expect(isImageFile('photo.png')).toBe(true);
    expect(isImageFile('photo.jpg')).toBe(true);
    expect(isImageFile('photo.jpeg')).toBe(true);
    expect(isImageFile('photo.gif')).toBe(true);
    expect(isImageFile('photo.webp')).toBe(true);
    expect(isImageFile('photo.svg')).toBe(true);
    expect(isImageFile('photo.bmp')).toBe(true);
    expect(isImageFile('photo.ico')).toBe(true);
    expect(isImageFile('photo.tiff')).toBe(true);
    expect(isImageFile('photo.avif')).toBe(true);
  });

  it('returns false for non-image extensions', () => {
    expect(isImageFile('main.go')).toBe(false);
    expect(isImageFile('styles.css')).toBe(false);
    expect(isImageFile('data.json')).toBe(false);
    expect(isImageFile('README.md')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isImageFile('photo.PNG')).toBe(true);
    expect(isImageFile('photo.JPG')).toBe(true);
    expect(isImageFile('photo.SVG')).toBe(true);
  });

  it('works with nested paths', () => {
    expect(isImageFile('assets/icons/logo.png')).toBe(true);
    expect(isImageFile('src/components/Button.vue')).toBe(false);
  });

  it('returns false for files with no extension', () => {
    expect(isImageFile('Makefile')).toBe(false);
    expect(isImageFile('')).toBe(false);
  });

  it('returns false for paths ending in a dot', () => {
    expect(isImageFile('file.')).toBe(false);
  });
});

describe('imageDataUrl', () => {
  it('produces a valid data URL for known mime types', () => {
    const url = imageDataUrl('photo.png', 'abc123');
    expect(url).toBe('data:image/png;base64,abc123');
  });

  it('maps jpg to image/jpeg', () => {
    const url = imageDataUrl('photo.jpg', 'xyz');
    expect(url).toBe('data:image/jpeg;base64,xyz');
  });

  it('maps svg to image/svg+xml', () => {
    const url = imageDataUrl('icon.svg', 'data');
    expect(url).toBe('data:image/svg+xml;base64,data');
  });

  it('falls back to image/png for unknown extensions', () => {
    const url = imageDataUrl('file.unknown', 'data');
    expect(url).toBe('data:image/png;base64,data');
  });

  it('works with nested paths', () => {
    const url = imageDataUrl('assets/logo.webp', 'b64');
    expect(url).toBe(`data:${IMAGE_MIME['webp']};base64,b64`);
  });
});
