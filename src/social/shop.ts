/**
 * The UPZZY store, read from Shopify's public product feed. Prices and stock
 * come from the store every time, so the app never shows a stale price.
 */

export const STORE_URL = 'https://www.upzzyworld.com';

export type ShopVariant = { id: number; title: string; price: string; available: boolean };
export type ShopProduct = {
  id: number;
  handle: string;
  title: string;
  description: string;
  images: string[];
  variants: ShopVariant[];
};

type RawProduct = {
  id: number;
  handle: string;
  title: string;
  body_html?: string | null;
  images?: { src: string }[];
  variants?: { id: number; title: string; price: string; available?: boolean }[];
};

/** Turns Shopify's `/products.json` into what the shop shows. Products without a photo or a variant are left out. */
export function parseProducts(json: unknown): ShopProduct[] {
  const raw = (json as { products?: RawProduct[] } | null)?.products ?? [];
  return raw
    .map((p) => ({
      id: p.id,
      handle: p.handle,
      title: p.title.toLowerCase(),
      description: plainText(p.body_html ?? ''),
      images: (p.images ?? []).map((i) => i.src),
      variants: (p.variants ?? []).map((v) => ({
        id: v.id,
        title: v.title === 'Default Title' ? '' : v.title.toLowerCase(),
        price: v.price,
        available: v.available !== false,
      })),
    }))
    .filter((p) => p.images.length > 0 && p.variants.length > 0);
}

/** Store HTML descriptions as plain text, one paragraph per line. */
export function plainText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** "$45" or "€45.50"; just the number when the store's currency is unknown. */
export function formatPrice(amount: string, currency: string | null): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  const whole = Number.isInteger(value);
  if (!currency) return whole ? String(value) : value.toFixed(2);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** The lowest price among the variants still in stock (or all of them if none are). */
export function fromPrice(product: ShopProduct): string {
  const pool = product.variants.some((v) => v.available) ? product.variants.filter((v) => v.available) : product.variants;
  return pool.reduce((low, v) => (Number(v.price) < Number(low) ? v.price : low), pool[0].price);
}

export const soldOut = (product: ShopProduct) => product.variants.every((v) => !v.available);

/** Shopify's cart link: it opens checkout with this piece already in the bag. */
export function checkoutUrl(variantId: number, quantity = 1, base = STORE_URL): string {
  return `${base}/cart/${variantId}:${Math.max(1, Math.floor(quantity))}`;
}
