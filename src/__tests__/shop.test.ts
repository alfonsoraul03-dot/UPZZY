import {
  addToBag,
  bagCount,
  bagTotal,
  canPick,
  checkoutUrl,
  colourPhotos,
  findVariant,
  formatPrice,
  imagesFor,
  MAX_PER_ITEM,
  parseProducts,
  plainText,
  priceLabel,
  setQuantity,
  soldOut,
  type BagItem,
} from '@/social/shop';

const raw = {
  products: [
    {
      handle: 'slip-tee',
      title: 'Slip Tee',
      body_html: '<p><strong>Our first mistake.</strong></p><p>Boxy &amp; heavy.</p>',
      options: [
        { name: 'Color', values: ['Bone', 'Black'] },
        { name: 'Size', values: ['S', 'M'] },
      ],
      variants: [
        { id: 1, option1: 'Bone', option2: 'S', price: '70.00', available: true },
        { id: 2, option1: 'Bone', option2: 'M', price: '70.00', available: false },
        { id: 3, option1: 'Black', option2: 'S', price: '70.00', available: true },
        { id: 4, option1: 'Black', option2: 'M', price: '75.50', available: true },
      ],
      images: [
        { src: 'bone.jpg', variant_ids: [1, 2] },
        { src: 'black.jpg', variant_ids: [3, 4] },
        { src: 'back.jpg', variant_ids: [] },
      ],
    },
    { handle: 'broken' },
  ],
};

const [tee] = parseProducts(raw);
const item = (variantId: number, price = '70.00'): Omit<BagItem, 'quantity'> => ({
  variantId,
  handle: 'slip-tee',
  title: 'Slip Tee',
  options: ['Bone', 'S'],
  price,
  image: null,
});

describe('shop', () => {
  it('reads the store list and skips broken products', () => {
    expect(parseProducts(raw)).toHaveLength(1);
    expect(parseProducts(null)).toEqual([]);
    expect(tee.variants[3]).toEqual({ id: 4, options: ['Black', 'M'], price: '75.50', available: true });
    expect(tee.description).toBe('Our first mistake.\n\nBoxy & heavy.');
  });

  it('turns html into plain text', () => {
    expect(plainText('<p>a</p><p>b<br>c</p>')).toBe('a\n\nb\n\nc');
  });

  it('formats prices in dollars', () => {
    expect(formatPrice('70.00')).toBe('$70');
    expect(formatPrice('95.50')).toBe('$95.50');
    expect(formatPrice('nope')).toBe('');
    expect(priceLabel(tee)).toBe('from $70');
  });

  it('finds the variant only once everything is chosen', () => {
    expect(findVariant(tee, ['Bone', null])).toBeNull();
    expect(findVariant(tee, ['Black', 'M'])?.id).toBe(4);
  });

  it('greys out choices that cannot be bought', () => {
    expect(canPick(tee, ['Bone', null], 1, 'M')).toBe(false);
    expect(canPick(tee, ['Black', null], 1, 'M')).toBe(true);
    expect(canPick(tee, [null, 'M'], 0, 'Bone')).toBe(false);
    expect(soldOut(tee)).toBe(false);
  });

  it('shows the chosen colour first', () => {
    expect(imagesFor(tee, null, 'Black')).toEqual(['black.jpg', 'bone.jpg', 'back.jpg']);
    expect(imagesFor(tee, tee.variants[0], null)[0]).toBe('bone.jpg');
  });

  it('picks one photo per colour for swatches', () => {
    expect(colourPhotos(tee)).toEqual([
      { value: 'Bone', image: 'bone.jpg' },
      { value: 'Black', image: 'black.jpg' },
    ]);
  });

  it('keeps a bag with a limit per item', () => {
    let bag = addToBag([], item(1));
    bag = addToBag(bag, item(1), 2);
    bag = addToBag(bag, item(4, '75.50'));
    expect(bagCount(bag)).toBe(4);
    expect(bagTotal(bag)).toBe(285.5);
    bag = addToBag(bag, item(1), 10);
    expect(bag[0].quantity).toBe(MAX_PER_ITEM);
    bag = setQuantity(bag, 1, 0);
    expect(bag.map((b) => b.variantId)).toEqual([4]);
  });

  it('builds the store cart link', () => {
    expect(checkoutUrl('https://shop.test/', [])).toBeNull();
    const bag = addToBag(addToBag([], item(1), 2), item(4));
    expect(checkoutUrl('https://shop.test/', bag)).toBe('https://shop.test/cart/1:2,4:1');
  });
});
