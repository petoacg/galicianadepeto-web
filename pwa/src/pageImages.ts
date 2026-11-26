/**
 * The last few page images of this visit, decoded and ready to draw (Android PageTurn).
 * Going back is instant and pages read ahead are ready when the reader gets there. Kept
 * in memory only, for the session: no document library is stored.
 */
export interface PageImage {url: string; width: number; height: number}

const KEEP = 5;
const images = new Map<string, PageImage>();
const reading = new Map<string, Promise<PageImage>>();

// An image is the same page whatever number a source gave it, so the image id leads the key:
// correcting the number after the page index arrives must not download or redraw it again.
export const pageKey = (path: string, position: number, imageId?: string) => imageId ? `${path}|img:${imageId}` : `${path}|${position}|`;

export function cachedPage(key: string): PageImage | undefined {
  const image = images.get(key);
  if (image) { images.delete(key); images.set(key, image); }
  return image;
}

/** A page that could not be drawn is downloaded again, not taken from memory. */
export function forgetPage(key: string) {
  const image = images.get(key);
  images.delete(key);
  if (image?.url.startsWith('blob:')) URL.revokeObjectURL(image.url);
}

function keep(key: string, image: PageImage) {
  images.delete(key);
  images.set(key, image);
  while (images.size > KEEP) {
    const [oldest, old] = images.entries().next().value as [string, PageImage];
    images.delete(oldest);
    if (old.url.startsWith('blob:')) URL.revokeObjectURL(old.url);
  }
}

/** The page image, from memory, from a download already on its way, or downloaded now. */
export function loadPage(path: string, position: number, imageId?: string): Promise<PageImage> {
  const key = pageKey(path, position, imageId);
  const ready = cachedPage(key);
  if (ready) return Promise.resolve(ready);
  const pending = reading.get(key);
  if (pending) return pending;
  const decode = async (url: string) => {
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    // Loaded is enough: decode() also refuses in a background tab, which is not a failure.
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('load')); image.src = url; });
    try { await image.decode(); } catch { /* drawn on first paint instead */ }
    return {url, width: image.naturalWidth, height: image.naturalHeight};
  };
  // Straight from Galiciana, as Android does: 70–170 ms instead of more than 2 s through the
  // Google script. The script stays as the fallback when the direct image fails.
  const direct = imageId ? decode(`https://biblioteca.galiciana.gal/es/catalogo_imagenes/imagen_id.do?idImagen=${encodeURIComponent(imageId)}`) : Promise.reject(new Error('no id'));
  const params = new URLSearchParams({path, position: String(position), imageId: imageId || ''});
  const viaScript = () => fetch('/api/image?' + params, {credentials: 'same-origin'})
    .then(response => { if (!response.ok) throw new Error(String(response.status)); return response.blob(); })
    .then(async blob => {
      const url = URL.createObjectURL(blob);
      try { return await decode(url); } catch { URL.revokeObjectURL(url); throw new Error('decode'); }
    });
  const request = direct.catch(viaScript)
    .then(page => { keep(key, page); return page; })
    .finally(() => reading.delete(key));
  reading.set(key, request);
  return request;
}

/** Direction of the last page turn, so reading ahead starts on the side the reader is going. */
export let readingDirection = 1;
export const setReadingDirection = (direction: number) => { readingDirection = direction < 0 ? -1 : 1; };
