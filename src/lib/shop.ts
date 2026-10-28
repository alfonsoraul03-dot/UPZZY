import * as WebBrowser from 'expo-web-browser';

import { checkoutUrl, parseProducts, type BagItem, type ShopProduct } from '@/social/shop';

/** The UPZZY store. Products, prices and stock are read from it, never copied into the app. */
export const STORE_URL = 'https://www.upzzyworld.com';
const COLLECTION = 'drop-001';

// Stock changes, so the list is only reused for a minute.
let cached: { at: number; products: ShopProduct[] } | null = null;

/** The pieces of the current drop, straight from the store's public product list. */
export async function getDrop(): Promise<ShopProduct[]> {
  if (cached && Date.now() - cached.at < 60_000) return cached.products;
  const res = await fetch(`${STORE_URL}/collections/${COLLECTION}/products.json?limit=50`);
  if (!res.ok) throw new Error("the shop didn't answer. try again.");
  const products = parseProducts(await res.json());
  cached = { at: Date.now(), products };
  return products;
}

export async function getProduct(handle: string): Promise<ShopProduct | null> {
  return (await getDrop()).find((p) => p.handle === handle) ?? null;
}

/**
 * Pays on the store's own checkout, in a secure sheet over the app. Card,
 * Apple Pay and the address all stay with the store.
 */
export async function openCheckout(bag: BagItem[]): Promise<void> {
  const url = checkoutUrl(STORE_URL, bag);
  if (!url) return;
  await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
}
