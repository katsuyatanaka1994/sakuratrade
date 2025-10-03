import React from 'react';

const iconCache = new Map<string | symbol, React.ForwardRefExoticComponent<any>>();

const createIcon = (name: string | symbol) => {
  const display = typeof name === 'string' ? name : 'Icon';
  const Icon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>((props, ref) =>
    React.createElement('svg', {
      ref,
      'data-lucide-mock': display,
      'aria-hidden': props['aria-hidden'] ?? true,
      focusable: props.focusable ?? 'false',
      role: props.role ?? 'img',
      ...props,
    })
  );
  Icon.displayName = `LucideMock(${display})`;
  return Icon;
};

const lucideReactStub: Record<string | symbol, any> = new Proxy({}, {
  get(_target, prop) {
    if (prop === '__esModule') {
      return true;
    }
    if (prop === 'default') {
      return lucideReactStub;
    }
    if (!iconCache.has(prop)) {
      iconCache.set(prop, createIcon(prop));
    }
    return iconCache.get(prop);
  },
});

export default lucideReactStub;
