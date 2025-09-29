import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

// localStorage が無い環境向けの最小モック
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as unknown as Storage;
}

// 各テスト後に localStorage をクリア
afterEach(() => {
  localStorage.clear();
});

// ===== Test env polyfills for Radix/MUI =====
if (typeof globalThis.PointerEvent === 'undefined') {
  // @ts-ignore
  globalThis.PointerEvent = class PointerEvent extends Event {};
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  // @ts-ignore
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  // @ts-ignore
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null; rootMargin = ''; thresholds = [];
  };
}

if (typeof window.matchMedia === 'undefined') {
  // @ts-ignore
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (typeof (globalThis as any).DOMRect === 'undefined') {
  (globalThis as any).DOMRect = {
    fromRect: () => ({ x:0, y:0, width:0, height:0, top:0, left:0, right:0, bottom:0 }),
  };
}

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as any;
}

// Shadow DOM を使う実装のためのダミー
if (!HTMLElement.prototype.attachShadow) {
  // @ts-ignore
  HTMLElement.prototype.attachShadow = function () { return this; };
}

// createRange の最小実装（選択系で使われることがある）
if (!document.createRange) {
  // @ts-ignore
  document.createRange = () => ({
    setStart: () => {}, setEnd: () => {},
    commonAncestorContainer: document.body,
    getBoundingClientRect: () => ({ x:0,y:0,width:0,height:0,top:0,left:0,right:0,bottom:0 }),
    getClientRects: () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }),
    cloneRange: () => ({}),
    deleteContents: () => {},
    extractContents: () => document.createDocumentFragment(),
    insertNode: () => {},
    selectNode: () => {},
    selectNodeContents: () => {},
    collapse: () => {},
    detach: () => {},
  });
}

// scrollIntoView の no-op
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Ensure libraries that expect global React/ReactDOM can find them
if (!(globalThis as any).React) {
  (globalThis as any).React = React;
}

if (!(globalThis as any).ReactDOM) {
  (globalThis as any).ReactDOM = ReactDOM;
}
