import * as WebBrowser from 'expo-web-browser';

import { checkoutUrl, parseProducts, STORE_URL, type ShopProduct } from '@/social/shop';

/** Everything for sale on upzzyworld.com, straight from Shopify. */
export async function getProducts(): Promise<ShopProduct[]> {
  const res = await fetch(`${STORE_URL}/products.json?limit=250`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`network: store answered ${res.status}`);
  return parseProducts(await res.json());
}

/** The store's currency (Shopify's empty cart says it), or null if it can't be read. */
export async function getCurrency(): Promise<string | null> {
  try {
    const res = await fetch(`${STORE_URL}/cart.js`, { headers: { Accept: 'application/json' } });
    const cart = (await res.json()) as { currency?: string };
    return cart.currency ?? null;
  } catch {
    return null;
  }
}

export type Shop = { products: ShopProduct[]; currency: string | null };

let cached: Promise<Shop> | null = null;

/** Products and currency, kept for the session so a product page opens at once. `fresh` asks the store again. */
export function loadShop(fresh = false): Promise<Shop> {
  if (!cached || fresh) {
    cached = Promise.all([getProducts(), getCurrency()]).then(([products, currency]) => ({ products, currency }));
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}

/** Opens Shopify's checkout over the app with this piece in the bag. Payment happens there. */
export async function buy(variantId: number): Promise<void> {
  await WebBrowser.openBrowserAsync(checkoutUrl(variantId), {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    dismissButtonStyle: 'close',
  });
}
