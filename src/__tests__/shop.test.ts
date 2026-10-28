import { checkoutUrl, formatPrice, fromPrice, parseProducts, plainText, soldOut } from '@/social/shop';

const feed = {
  products: [
    {
      id: 1,
      handle: 'slip-tee',
      title: 'Slip Tee',
      body_html: '<p>front: the slip.</p><p>back: the&nbsp;confession.</p>',
      images: [{ src: 'https://cdn.shopify.com/a.jpg' }],
      variants: [
        { id: 11, title: 'S', price: '45.00', available: false },
        { id: 12, title: 'M', price: '45.00', available: true },
      ],
    },
    { id: 2, handle: 'no-photo', title: 'No Photo', images: [], variants: [{ id: 21, title: 'Default Title', price: '10.00' }] },
    {
      id: 3,
      handle: 'sticker',
      title: 'Sticker',
      images: [{ src: 'https://cdn.shopify.com/b.jpg' }],
      variants: [{ id: 31, title: 'Default Title', price: '5.50', available: false }],
    },
  ],
};

describe('shop', () => {
  it('reads the store feed and leaves out products without a photo', () => {
    const products = parseProducts(feed);
    expect(products.map((p) => p.handle)).toEqual(['slip-tee', 'sticker']);
    expect(products[0]).toMatchObject({ title: 'slip tee', description: 'front: the slip.\nback: the confession.' });
    expect(products[0].variants).toEqual([
      { id: 11, title: 's', price: '45.00', available: false },
      { id: 12, title: 'm', price: '45.00', available: true },
    ]);
    expect(products[1].variants[0].title).toBe('');
    expect(parseProducts(null)).toEqual([]);
  });

  it('knows when a piece is sold out', () => {
    const [tee, sticker] = parseProducts(feed);
    expect(soldOut(tee)).toBe(false);
    expect(soldOut(sticker)).toBe(true);
    expect(fromPrice(sticker)).toBe('5.50');
  });

  it('starts from the cheapest size still in stock', () => {
    const [tee] = parseProducts({
      products: [
        {
          ...feed.products[0],
          variants: [
            { id: 1, title: 'XS', price: '30.00', available: false },
            { id: 2, title: 'M', price: '45.00', available: true },
            { id: 3, title: 'XL', price: '50.00', available: true },
          ],
        },
      ],
    });
    expect(fromPrice(tee)).toBe('45.00');
  });

  it('writes prices the short way', () => {
    expect(formatPrice('45.00', 'USD')).toBe('$45');
    expect(formatPrice('45.5', 'USD')).toBe('$45.50');
    expect(formatPrice('45.00', null)).toBe('45');
    expect(formatPrice('abc', 'USD')).toBe('abc');
  });

  it('turns store html into plain lines', () => {
    expect(plainText('<ul><li>100% cotton</li><li>made &amp; numbered</li></ul>')).toBe('100% cotton\nmade & numbered');
    expect(plainText('')).toBe('');
  });

  it('links straight to checkout with the piece in the bag', () => {
    expect(checkoutUrl(12)).toBe('https://www.upzzyworld.com/cart/12:1');
    expect(checkoutUrl(12, 0)).toBe('https://www.upzzyworld.com/cart/12:1');
    expect(checkoutUrl(12, 2, 'https://x.test')).toBe('https://x.test/cart/12:2');
  });
});
