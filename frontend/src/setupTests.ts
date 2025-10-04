import { afterEach, beforeEach, vi } from 'vitest';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { TextDecoder, TextEncoder } from 'node:util';

import { routerDomStub, resetRouterDomStub } from './test-utils/stubs/router';
import {
  resetToastStub,
  ToastProvider as MockToastProvider,
  useToast as useToastStub,
} from './test-utils/stubs/toast';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
const apiBaseUrl = process.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
process.env.VITE_API_BASE_URL = apiBaseUrl;
vi.stubEnv('VITE_API_BASE_URL', apiBaseUrl);

const defaultFetchImplementation = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
  });

const fetchMock = vi.fn(defaultFetchImplementation);

Object.defineProperty(globalThis, 'fetch', {
  value: fetchMock,
  configurable: true,
  writable: true,
});

if (typeof globalThis.TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = TextDecoder;
}

beforeEach(() => {
  fetchMock.mockImplementation(defaultFetchImplementation);
});

afterEach(() => {
  localStorage.clear();
  sessionStorage?.clear?.();
  resetRouterDomStub();
  resetToastStub();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

// ===== Test env polyfills for Radix/MUI =====
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = class PointerEvent extends Event {} as typeof PointerEvent;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null; rootMargin = ''; thresholds: number[] = [];
  } as unknown as typeof IntersectionObserver;
}

if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}

if (typeof (globalThis as any).DOMRect === 'undefined') {
  (globalThis as any).DOMRect = {
    fromRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
  };
}

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as any;
}

if (!HTMLElement.prototype.attachShadow) {
  HTMLElement.prototype.attachShadow = function () {
    return this;
  } as typeof HTMLElement.prototype.attachShadow;
}

if (!document.createRange) {
  document.createRange = () => ({
    setStart: () => {},
    setEnd: () => {},
    commonAncestorContainer: document.body,
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
    getClientRects: () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }),
    cloneRange: () => ({}),
    deleteContents: () => {},
    extractContents: () => document.createDocumentFragment(),
    insertNode: () => {},
    selectNode: () => {},
    selectNodeContents: () => {},
    collapse: () => {},
    detach: () => {},
  }) as unknown as Range;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!(globalThis as any).React) {
  (globalThis as any).React = React;
}

if (!(globalThis as any).ReactDOM) {
  (globalThis as any).ReactDOM = ReactDOM;
}

const createElement = React.createElement;

// ---- HTMLFormElement.requestSubmit polyfill（JSDOM で submit を安定させる）----
if (!(HTMLFormElement.prototype as any).requestSubmit) {
  (HTMLFormElement.prototype as any).requestSubmit = function (submitter?: HTMLElement) {
    if (submitter && typeof (submitter as any).click === 'function') {
      (submitter as any).click();
      return;
    }
    const btn =
      this.querySelector('button[type="submit"], input[type="submit"]') as
        | HTMLButtonElement
        | HTMLInputElement
        | null;

    if (btn && typeof (btn as any).click === 'function') {
      (btn as any).click();
      return;
    }
    this.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  };
}

// ---- submit イベントの submitter を最低限で補う（JSDOM で undefined になりがち）----
(() => {
  const proto = HTMLFormElement.prototype as any;
  const originalAdd = proto.addEventListener;
  if (!originalAdd.__patchedForSubmitter) {
    proto.addEventListener = function (type: string, listener: any, options?: any) {
      if (type === 'submit') {
        const wrapped = (ev: Event) => {
          if (!(ev as any).submitter) {
            const active = document.activeElement as HTMLElement | null;
            if (
              active &&
              (active.tagName === 'BUTTON' || active.tagName === 'INPUT') &&
              (active as HTMLButtonElement | HTMLInputElement).type === 'submit'
            ) {
              (ev as any).submitter = active;
            }
          }
          return listener(ev);
        };
        return originalAdd.call(this, type, wrapped, options);
      }
      return originalAdd.call(this, type, listener, options);
    };
    proto.addEventListener.__patchedForSubmitter = true;
  }
})();

vi.mock('marked', () => ({
  marked: {
    parse: vi.fn((markdown: string) => `<p>${markdown}</p>`),
  },
}));

vi.mock('@/services/api', () => ({
  getAdvice: vi.fn(() => Promise.resolve({
    pattern_name: 'Test Pattern',
    score: 85,
    advice_html: '<p>Test advice</p>',
  })),
}));

vi.mock('react-router-dom', () => routerDomStub);

vi.mock('@/components/UI/button', () => {
  const React = require('react');
  const createElement = React.createElement;

  const Button = ({
    children,
    onClick,
    type,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const btnType = (type ?? btn.getAttribute('type') ?? 'button').toLowerCase();

      if (btnType === 'submit') {
        const form = btn.closest('form') as HTMLFormElement | null;
        form?.requestSubmit?.(btn);
      }

      onClick?.(e);
    };

    return createElement(
      'button',
      { ...rest, type: type ?? 'button', onClick: handleClick },
      children
    );
  };

  Button.displayName = 'MockButton';
  return { Button };
});

vi.mock('@/components/UI/input', () => {
  const React = require('react');
  const createElement = React.createElement;
  const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => createElement('input', { ref, ...props })
  );
  Input.displayName = 'MockInput';
  return { Input };
});

vi.mock('@/components/UI/label', () => ({
  Label: ({ children, ...rest }: any) => createElement('label', { ...rest }, children),
}));

vi.mock('@/components/ToastContainer', () => ({
  ToastProvider: MockToastProvider,
  useToast: useToastStub,
}));

// TODO: extend allowlists per tag so swapping to button/input keeps the same filtering guarantees
const sanitiseDomProps = (
  tag: 'div' | 'button' = 'div',
  props?: Record<string, unknown>
) => {
  if (!props) return {};

  const commonAllow = new Set([
    'id',
    'className',
    'style',
    'role',
    'tabIndex',
    'title',
  ]);

  const divAllow = new Set([
    ...commonAllow,
    'onClick',
    'onKeyDown',
    'onKeyUp',
    'onMouseDown',
    'onMouseUp',
    'onMouseEnter',
    'onMouseLeave',
    'onMouseMove',
    'onFocus',
    'onBlur',
    'onContextMenu',
  ]);

  const buttonAllow = new Set([
    ...commonAllow,
    'type',
    'disabled',
    'name',
    'value',
    'onClick',
    'onKeyDown',
    'onKeyUp',
    'onKeyPress',
    'onMouseDown',
    'onMouseUp',
    'onMouseEnter',
    'onMouseLeave',
    'onMouseMove',
    'onFocus',
    'onBlur',
    'onContextMenu',
  ]);

  const allow = tag === 'button' ? buttonAllow : divAllow;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (key.startsWith('data-') || key.startsWith('aria-')) {
      out[key] = value;
      continue;
    }

    if (key.startsWith('on')) {
      if (allow.has(key)) {
        out[key] = value;
      }
      continue;
    }

    if (allow.has(key)) {
      out[key] = value;
    }
  }

  return out;
};

type SelectOnValueChange = (value: string) => void;

type SelectContextType = {
  value: string | undefined;
  setValue: (value: string) => void;
  label: string | undefined;
  setLabel: (label: string) => void;
  onValueChange?: SelectOnValueChange;
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerId: string | undefined;
  setTriggerId: (id: string | undefined) => void;
  registerOption: (value: string, label: string) => void;
  unregisterOption: (value: string) => void;
  getLabelForValue: (value?: string) => string | undefined;
};

const SelectContext = React.createContext<SelectContextType | null>(null);

vi.mock('@/components/UI/dialog', () => ({
  Dialog: ({ children, open, ...rest }: any) =>
    open ? createElement('div', sanitiseDomProps('div', rest), children) : null,
  DialogContent: ({ children, ...rest }: any) => createElement('div', { ...rest }, children),
  DialogHeader: ({ children, ...rest }: any) => createElement('div', { ...rest }, children),
  DialogTitle: ({ children, ...rest }: any) => createElement('h2', { ...rest }, children),
  DialogDescription: ({ children, ...rest }: any) => createElement('p', { ...rest }, children),
  DialogFooter: ({ children, ...rest }: any) => createElement('div', { ...rest }, children),
}));

vi.mock('@/components/UI/textarea', () => {
  const React = require('react');
  const createElement = React.createElement;
  const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    (props, ref) => createElement('textarea', { ref, ...props })
  );
  Textarea.displayName = 'MockTextarea';
  return { Textarea };
});

vi.mock('@/components/UI/select', () => {
  const coerceLabel = (value: unknown): string | undefined => {
    if (value == null) return undefined;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return undefined;
  };

  const extractChildText = (content: React.ReactNode): string | undefined => {
    let result: string | undefined;
    React.Children.forEach(content, (child) => {
      if (result !== undefined) {
        return;
      }
      if (typeof child === 'string' || typeof child === 'number') {
        const text = String(child).trim();
        if (text.length > 0) {
          result = text;
        }
        return;
      }
      if (React.isValidElement(child)) {
        const nested = extractChildText(child.props?.children);
        if (nested !== undefined) {
          result = nested;
        }
      }
    });
    return result;
  };

  const Select = (
    props: React.HTMLAttributes<HTMLDivElement> & {
      value?: string;
      defaultValue?: string;
      onValueChange?: SelectOnValueChange;
      children: React.ReactNode;
    }
  ) => {
    const { children, value, defaultValue, onValueChange, ...rest } = props;
    const hasValueProp = Object.prototype.hasOwnProperty.call(props, 'value');
    const [internalValue, setInternalValue] = React.useState<string | undefined>(
      hasValueProp ? value : defaultValue
    );
    const [labelState, setLabelState] = React.useState<string | undefined>(undefined);
    const [open, setOpen] = React.useState(false);
    const [triggerId, setTriggerIdState] = React.useState<string | undefined>(undefined);
    const optionLabelsRef = React.useRef(new Map<string, string>());

    const isControlled = hasValueProp;
    const currentValue = isControlled ? value : internalValue;

    React.useEffect(() => {
      if (isControlled) {
        setInternalValue(value);
        if (value === undefined) {
          setLabelState(undefined);
          return;
        }
        const existing = optionLabelsRef.current.get(value);
        if (existing !== undefined) {
          setLabelState(existing);
        }
      }
    }, [isControlled, value]);

    const setValueState = React.useCallback((nextValue: string) => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }
    }, [isControlled]);

    const setLabel = React.useCallback((nextLabel: string) => {
      setLabelState(nextLabel);
    }, []);

    const setTriggerId = React.useCallback((nextId: string | undefined) => {
      setTriggerIdState(nextId);
    }, []);

    const registerOption = React.useCallback((optionValue: string, optionLabel: string) => {
      optionLabelsRef.current.set(optionValue, optionLabel);
      if (optionValue === currentValue) {
        setLabelState((prev) => prev ?? optionLabel);
      }
    }, [currentValue]);

    const unregisterOption = React.useCallback((optionValue: string) => {
      optionLabelsRef.current.delete(optionValue);
    }, []);

    const getLabelForValue = React.useCallback((optionValue?: string) => {
      if (!optionValue) return undefined;
      return optionLabelsRef.current.get(optionValue);
    }, []);

    const contextValue = React.useMemo<SelectContextType>(
      () => ({
        value: currentValue,
        setValue: setValueState,
        label: labelState,
        setLabel,
        onValueChange,
        open,
        setOpen,
        triggerId,
        setTriggerId,
        registerOption,
        unregisterOption,
        getLabelForValue,
      }),
      [currentValue, setValueState, labelState, setLabel, onValueChange, open, triggerId, setTriggerId, registerOption, unregisterOption, getLabelForValue]
    );

    const restRecord = rest as Record<string, unknown>;
    const sanitisedProps = sanitiseDomProps('div', {
      ...restRecord,
      'data-testid': restRecord?.['data-testid'] ?? 'select',
    });

    const element = createElement(
      SelectContext.Provider,
      { value: contextValue },
      createElement('div', sanitisedProps, children)
    );
    return element;
  };

  const SelectTrigger = ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => {
    const context = React.useContext(SelectContext);
    const { id, className, onClick, ...rest } = props;
    const sanitized = sanitiseDomProps('button', rest as Record<string, unknown>) as React.HTMLAttributes<HTMLButtonElement>;

    React.useEffect(() => {
      context?.setTriggerId(id);
      return () => context?.setTriggerId(undefined);
    }, [context, id]);

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event);
      const nextOpen = !(context?.open ?? false);
      context?.setOpen(nextOpen);
      sanitized.onClick?.(event);
    };

    const derivedControls = sanitized['aria-controls'] ?? (id ? `${id}-content` : (context?.triggerId ? `${context.triggerId}-content` : undefined));
    const propsRecord = props as Record<string, unknown>;

    const resolvedLabel =
      coerceLabel(propsRecord['data-selected-label']) ??
      coerceLabel(context?.label) ??
      coerceLabel(context?.getLabelForValue?.(context?.value)) ??
      coerceLabel(extractChildText(children));

    // ★ ここがポイント：関連する <label for="..."> があれば、それをアクセシブル・ネームに優先させる
    const hasAssociatedNativeLabel = !!id && !!document.querySelector(`label[for="${id}"]`);

    const computedAriaLabel =
      sanitized['aria-label'] ??
      (hasAssociatedNativeLabel ? undefined : resolvedLabel) ??
      undefined;

    const displayedChildren = resolvedLabel !== undefined ? resolvedLabel : children;

    // ARIA policy: favour consumer-provided attributes, fill in sensible defaults only when absent.
    return createElement(
      'button',
      {
        ...sanitized,
        type: sanitized.type ?? 'button',
        role: sanitized.role ?? 'combobox',
        id,
        className,
        'aria-haspopup': sanitized['aria-haspopup'] ?? 'listbox',
        'aria-expanded': sanitized['aria-expanded'] ?? (context?.open ?? false),
        'aria-controls': derivedControls,
        'aria-label': computedAriaLabel,
        onClick: handleClick,
      },
      displayedChildren
    );
  };

  const SelectContent = ({ children, id, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { id?: string }) => {
    const context = React.useContext(SelectContext);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const sanitized = sanitiseDomProps('div', props as Record<string, unknown>) as React.HTMLAttributes<HTMLDivElement>;
    const resolvedId = id ?? (context?.triggerId ? `${context.triggerId}-content` : undefined);

    const focusBy = (direction: 1 | -1) => {
      const options = containerRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])');
      if (!options || options.length === 0) return;
      const current = document.activeElement as HTMLElement | null;
      const optionArray = Array.from(options);
      const selectedIndex = optionArray.findIndex((element) => element.getAttribute('data-value') === (context?.value ?? null));
      const currentIndex = current ? optionArray.indexOf(current) : -1;
      const baseIndex = currentIndex >= 0 ? currentIndex : selectedIndex;
      const nextIndex = baseIndex >= 0
        ? (baseIndex + direction + optionArray.length) % optionArray.length
        : (direction === 1 ? 0 : optionArray.length - 1);
      const next = optionArray[nextIndex];
      next?.focus();
    };

    const originalKeyDown = sanitized.onKeyDown;

    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusBy(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusBy(-1);
      } else if (event.key === 'Enter') {
        (document.activeElement as HTMLElement | null)?.click();
      } else if (event.key === 'Escape') {
        context?.setOpen(false);
      }
      originalKeyDown?.(event);
    };

    if (!context?.open) {
      return null;
    }

    return createElement(
      'div',
      {
        ...sanitized,
        ref: containerRef,
        role: sanitized.role ?? 'listbox',
        id: resolvedId,
        className,
        tabIndex: sanitized.tabIndex ?? -1,
        onKeyDown: handleKeyDown,
      },
      children
    );
  };

  type SelectItemProps = React.HTMLAttributes<HTMLDivElement> & {
    value: string;
    disabled?: boolean;
    'data-label'?: string;
  };

  const SelectItem = ({
    value,
    children,
    disabled,
    ...props
  }: SelectItemProps) => {
    const context = React.useContext(SelectContext);
    const dataLabel = (props as Record<string, unknown>)['data-label'];
    const sanitized = sanitiseDomProps('div', props as Record<string, unknown>) as React.HTMLAttributes<HTMLDivElement> & {
      'data-label'?: string;
      'data-value'?: string;
    };
    const originalOnClick = sanitized.onClick;
    const sanitizedDataLabel = sanitized['data-label'];

    const staticLabel = React.useMemo(() => {
      const explicit = coerceLabel(dataLabel ?? sanitizedDataLabel);
      return explicit ?? coerceLabel(extractChildText(children)) ?? value;
    }, [children, dataLabel, sanitizedDataLabel, value]);

    React.useEffect(() => {
      if (!context) return;
      context.registerOption(value, staticLabel);
      return () => {
        context.unregisterOption(value);
      };
    }, [context, staticLabel, value]);

    const handleClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
      if (disabled) {
        return;
      }
      originalOnClick?.(event);
      const explicit = coerceLabel(dataLabel ?? sanitizedDataLabel);
      const fromText = coerceLabel((event.currentTarget.textContent ?? '').trim());
      const label = explicit ?? fromText ?? staticLabel;
      context?.setValue(value);
      context?.setLabel(label);
      context?.onValueChange?.(value);
      context?.setOpen(false);
    };

    return createElement(
      'div',
      {
        ...sanitized,
        role: sanitized.role ?? 'option',
        'data-value': sanitized['data-value'] ?? value,
        'data-label': sanitized['data-label'] ?? dataLabel,
        'aria-selected': sanitized['aria-selected'] ?? (context?.value === value),
        'aria-disabled': sanitized['aria-disabled'] ?? (disabled ? 'true' : undefined),
        tabIndex: disabled ? -1 : sanitized.tabIndex ?? 0,
        onClick: handleClick,
      },
      children
    );
  };

  const SelectValue = ({ placeholder, ...props }: React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }) => {
    const context = React.useContext(SelectContext);
    const sanitized = sanitiseDomProps('div', props as Record<string, unknown>) as React.HTMLAttributes<HTMLSpanElement>;
    const display = context?.label ?? context?.value ?? placeholder ?? null;
    return createElement('span', sanitized, display);
  };

  return {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  };
});

vi.mock('lucide-react', () => {
  const React = require('react');
  const cache = new Map<string, React.ComponentType<any>>();

  const createIcon = (name: string) => {
    if (!cache.has(name)) {
      const Icon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>((props, ref) =>
        React.createElement('svg', {
          ref,
          'data-lucide-mock': name,
          'aria-hidden': props['aria-hidden'] ?? true,
          focusable: props.focusable ?? 'false',
          role: props.role ?? 'img',
          ...props,
        })
      );
      Icon.displayName = `LucideMock(${name})`;
      cache.set(name, Icon);
    }
    return cache.get(name)!;
  };

  return new Proxy({ __esModule: true, default: {} }, {
    get(target, prop: string | symbol) {
      if (typeof prop !== 'string') {
        return Reflect.get(target, prop);
      }
      if (prop in target) {
        return (target as any)[prop];
      }
      const icon = createIcon(prop);
      (target as any)[prop] = icon;
      return icon;
    },
  });
});
