/**
 * The shop, without the network: reading the store's product list, picking a
 * colour and size, and the bag. Prices and stock always come from the store;
 * the bag only remembers which variant and how many.
 */

export type ShopVariant = {
  id: number;
  /** One value per option, in the product's option order, e.g. ['Bone', 'M']. */
  options: string[];
  price: string;
  available: boolean;
};

export type ShopImage = { src: string; variantIds: number[] };

export type ShopProduct = {
  handle: string;
  title: string;
  /** Plain text, from the store's description. */
  description: string;
  options: { name: string; values: string[] }[];
  variants: ShopVariant[];
  images: ShopImage[];
};

export type BagItem = { variantId: number; handle: string; title: string; options: string[]; price: string; image: string | null; quantity: number };

export const MAX_PER_ITEM = 5;

type RawProduct = {
  handle: string;
  title: string;
  body_html?: string | null;
  options?: { name: string; values: string[] }[];
  variants?: { id: number; option1?: string | null; option2?: string | null; option3?: string | null; price: string; available: boolean }[];
  images?: { src: string; variant_ids?: number[] }[];
};

/** Turns the store's `products.json` into products. Skips anything malformed. */
export function parseProducts(json: unknown): ShopProduct[] {
  const list = (json as { products?: RawProduct[] } | null)?.products;
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => p && typeof p.handle === 'string' && typeof p.title === 'string' && Array.isArray(p.variants) && p.variants.length > 0)
    .map((p) => ({
      handle: p.handle,
      title: p.title,
      description: plainText(p.body_html ?? ''),
      options: (p.options ?? []).filter((o) => o.name !== 'Title'),
      variants: p.variants!.map((v) => ({
        id: v.id,
        options: [v.option1, v.option2, v.option3].filter((o): o is string => !!o && o !== 'Default Title'),
        price: v.price,
        available: !!v.available,
      })),
      images: (p.images ?? []).map((i) => ({ src: i.src, variantIds: i.variant_ids ?? [] })),
    }));
}

/** HTML description to plain text, paragraphs kept as blank lines. */
export function plainText(html: string): string {
  return html
    .replace(/<\/(p|div|h\d|li)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n\n');
}

/** "70.00" → "$70", "95.50" → "$95.50". The store sells in USD. */
export function formatPrice(price: string | number): string {
  const n = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(n)) return '';
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/** The variant matching every chosen option, or null while something is not chosen. */
export function findVariant(product: ShopProduct, chosen: (string | null)[]): ShopVariant | null {
  if (product.options.length === 0) return product.variants[0] ?? null;
  if (chosen.length < product.options.length || chosen.some((c) => !c)) return null;
  return product.variants.find((v) => v.options.every((o, i) => o === chosen[i])) ?? null;
}

/** Whether `value` for option `index` can still be bought, given the other choices so far. */
export function canPick(product: ShopProduct, chosen: (string | null)[], index: number, value: string): boolean {
  return product.variants.some(
    (v) => v.available && v.options[index] === value && v.options.every((o, i) => i === index || !chosen[i] || chosen[i] === o),
  );
}

export function soldOut(product: ShopProduct): boolean {
  return !product.variants.some((v) => v.available);
}

/** "from $70" when prices differ, else "$70". */
export function priceLabel(product: ShopProduct): string {
  const prices = product.variants.map((v) => Number(v.price)).filter(Number.isFinite);
  if (!prices.length) return '';
  const low = Math.min(...prices);
  return `${low === Math.max(...prices) ? '' : 'from '}${formatPrice(low)}`;
}

/** Photos for the chosen colour first, then the rest. */
export function imagesFor(product: ShopProduct, variant: ShopVariant | null, chosenColour: string | null): string[] {
  const ids = new Set(
    variant ? [variant.id] : product.variants.filter((v) => chosenColour && v.options.includes(chosenColour)).map((v) => v.id),
  );
  const first = product.images.filter((i) => i.variantIds.some((id) => ids.has(id)));
  const rest = product.images.filter((i) => !first.includes(i));
  return [...first, ...rest].map((i) => i.src);
}

/** Adds one, or more of the same, never past MAX_PER_ITEM. */
export function addToBag(bag: BagItem[], item: Omit<BagItem, 'quantity'>, quantity = 1): BagItem[] {
  const found = bag.find((b) => b.variantId === item.variantId);
  if (!found) return [...bag, { ...item, quantity: Math.min(Math.max(quantity, 1), MAX_PER_ITEM) }];
  return bag.map((b) => (b.variantId === item.variantId ? { ...b, quantity: Math.min(b.quantity + quantity, MAX_PER_ITEM) } : b));
}

/** Sets how many; 0 takes it out. */
export function setQuantity(bag: BagItem[], variantId: number, quantity: number): BagItem[] {
  if (quantity <= 0) return bag.filter((b) => b.variantId !== variantId);
  return bag.map((b) => (b.variantId === variantId ? { ...b, quantity: Math.min(quantity, MAX_PER_ITEM) } : b));
}

export function bagCount(bag: BagItem[]): number {
  return bag.reduce((n, b) => n + b.quantity, 0);
}

export function bagTotal(bag: BagItem[]): number {
  return Math.round(bag.reduce((n, b) => n + Number(b.price) * b.quantity, 0) * 100) / 100;
}

/** The store's own cart link: it fills the cart and opens checkout. */
export function checkoutUrl(store: string, bag: BagItem[]): string | null {
  const items = bag.filter((b) => b.quantity > 0);
  if (!items.length) return null;
  return `${store.replace(/\/$/, '')}/cart/${items.map((b) => `${b.variantId}:${b.quantity}`).join(',')}`;
}

/** One photo per value of the colour option, for swatches. Empty when the product has no colour. */
export function colourPhotos(product: ShopProduct): { value: string; image: string | null }[] {
  const index = product.options.findIndex((o) => /colou?r/i.test(o.name));
  if (index < 0) return [];
  return product.options[index].values.map((value) => {
    const ids = new Set(product.variants.filter((v) => v.options[index] === value).map((v) => v.id));
    return { value, image: product.images.find((i) => i.variantIds.some((id) => ids.has(id)))?.src ?? null };
  });
}
