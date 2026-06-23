const SKIP_TYPES = new Set(['image/heic', 'image/heif', 'image/svg+xml', 'image/gif']);

/**
 * Resizes and re-encodes an image file to WebP before upload.
 * HEIC/HEIF/SVG/GIF are returned unchanged (browser can't canvas-decode them).
 * If the image is already narrower than maxWidth it is still re-encoded
 * to WebP for size savings unless it is already small (< 150 KB).
 */
const compressImage = (file, maxWidth = 2000, quality = 0.85) => {
  if (SKIP_TYPES.has(file.type)) return Promise.resolve(file);

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const alreadySmall = img.naturalWidth <= maxWidth && file.size < 150 * 1024;
      if (alreadySmall) { resolve(file); return; }

      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const outName = file.name.replace(/\.[^.]+$/, '.webp');
          resolve(new File([blob], outName, { type: 'image/webp' }));
        },
        'image/webp',
        quality,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
};

export default compressImage;
