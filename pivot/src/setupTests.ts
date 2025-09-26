
import '@testing-library/jest-dom';

// --- Minimal global cleanup ---
afterEach(() => {
  try {
    localStorage.clear();
  } catch {}
});

// --- Polyfills used by Radix/MUI and similar libs ---
if (typeof globalThis.PointerEvent === 'undefined') {
  // @ts-ignore
  globalThis.PointerEvent = class PointerEvent extends Event {} as any;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  // @ts-ignore
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  // @ts-ignore
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null as unknown as Element | null;
    rootMargin = '';
    thresholds: number[] = [];
  } as any;
}

if (typeof window.matchMedia === 'undefined') {
  // @ts-ignore
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
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

// Shadow DOM helper for libs that call attachShadow
if (!HTMLElement.prototype.attachShadow) {
  // @ts-ignore
  HTMLElement.prototype.attachShadow = function () { return this; } as any;
}

// Selection API stub used by some editors/tooltips
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

// scrollIntoView can be invoked by focus management; make it a no-op in tests
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
