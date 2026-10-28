import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { addToBag, setQuantity, type BagItem } from '@/social/shop';

const KEY = 'upzzy.bag.v1';

// Shared by every screen, so the count on the shop updates when you add on a product.
let bag: BagItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function save(next: BagItem[]) {
  bag = next;
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      const stored = raw ? (JSON.parse(raw) as BagItem[]) : [];
      if (Array.isArray(stored) && stored.length && !bag.length) {
        bag = stored;
        emit();
      }
    })
    .catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => bag;

/** The bag on this phone: what you picked and how many. Kept between launches. */
export function useBag() {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(load, []);

  return {
    bag: current,
    add: (item: Omit<BagItem, 'quantity'>) => save(addToBag(bag, item)),
    setQuantity: (variantId: number, quantity: number) => save(setQuantity(bag, variantId, quantity)),
    clear: () => save([]),
  };
}
