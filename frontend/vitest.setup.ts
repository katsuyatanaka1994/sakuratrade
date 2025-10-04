import '@testing-library/jest-dom/vitest';
import { expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

type StorageKey = 'localStorage' | 'sessionStorage';

const createStorageStub = (): Storage => {
  const store = new Map<string, string>();

  const getItem: Storage['getItem'] = (key) => (store.has(key) ? store.get(key)! : null);
  const setItem: Storage['setItem'] = (key, value) => {
    store.set(key, String(value));
  };
  const removeItem: Storage['removeItem'] = (key) => {
    store.delete(key);
  };
  const clear: Storage['clear'] = () => {
    store.clear();
  };
  const keyMethod: Storage['key'] = (index) => Array.from(store.keys())[index] ?? null;

  return {
    getItem: vi.fn(getItem) as Storage['getItem'],
    setItem: vi.fn(setItem) as Storage['setItem'],
    removeItem: vi.fn(removeItem) as Storage['removeItem'],
    clear: vi.fn(clear) as Storage['clear'],
    key: vi.fn(keyMethod) as Storage['key'],
    get length() {
      return store.size;
    },
  } as Storage;
};

const ensureStorage = (key: StorageKey) => {
  const existing = globalThis[key as keyof typeof globalThis] as Storage | undefined;
  if (typeof existing === 'undefined' || existing === null) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: createStorageStub(),
    });
  }
};

ensureStorage('localStorage');
ensureStorage('sessionStorage');

export { createStorageStub };
