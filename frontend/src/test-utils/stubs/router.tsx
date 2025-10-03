import React from 'react';
import { vi } from 'vitest';

type LocationState = unknown;

const createDefaultLocation = () => ({
  pathname: '/',
  search: '',
  hash: '',
  state: null as LocationState,
  key: 'mock-location-key',
});

const navigateSpy = vi.fn<(to: string | number, options?: { replace?: boolean; state?: LocationState }) => void>();
const setSearchParamsSpy = vi.fn<
  (init: string | URLSearchParams | Record<string, string>, options?: { replace?: boolean }) => void
>();

const locationRef = createDefaultLocation();
const paramsRef: Record<string, string | undefined> = {};

const useNavigateImpl = vi.fn(() => navigateSpy);
const useLocationImpl = vi.fn(() => ({ ...locationRef }));
const useParamsImpl = vi.fn(() => ({ ...paramsRef }));
const useSearchParamsImpl = vi.fn(() => [new URLSearchParams(locationRef.search), setSearchParamsSpy] as const);
const useMatchImpl = vi.fn(() => null);
const useRouteErrorImpl = vi.fn(() => null);

const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

const Link = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ children, ...props }, ref) => React.createElement('a', { ref, ...props }, children)
);
Link.displayName = 'RouterLinkMock';

const NavLink = Link;

const Navigate = ({ to }: { to: string | number }) =>
  React.createElement('span', { 'data-router-navigate-to': String(to) });

const Outlet = () => null;

const createPath = (path: { pathname?: string; search?: string; hash?: string }) => {
  const pathname = path.pathname ?? '';
  const search = path.search ?? '';
  const hash = path.hash ?? '';
  return `${pathname}${search}${hash}`;
};

export const routerDomStub = {
  Link,
  NavLink,
  Outlet,
  Navigate,
  BrowserRouter: passthrough,
  MemoryRouter: passthrough,
  RouterProvider: passthrough,
  Routes: passthrough,
  Route: ({ element }: { element?: React.ReactNode }) => (element ?? null),
  createPath,
  useNavigate: useNavigateImpl,
  useLocation: useLocationImpl,
  useParams: useParamsImpl,
  useSearchParams: useSearchParamsImpl,
  useMatch: useMatchImpl,
  useRouteError: useRouteErrorImpl,
  __spies: {
    navigate: navigateSpy,
    setSearchParams: setSearchParamsSpy,
  },
};

export const setMockLocation = (next: Partial<typeof locationRef>) => {
  Object.assign(locationRef, next);
};

export const setMockParams = (params: Record<string, string | undefined>) => {
  for (const key of Object.keys(paramsRef)) {
    delete paramsRef[key];
  }
  Object.assign(paramsRef, params);
};

export const resetRouterDomStub = () => {
  Object.assign(locationRef, createDefaultLocation());
  for (const key of Object.keys(paramsRef)) {
    delete paramsRef[key];
  }
  navigateSpy.mockReset();
  setSearchParamsSpy.mockReset();
  useNavigateImpl.mockClear();
  useLocationImpl.mockClear();
  useParamsImpl.mockClear();
  useSearchParamsImpl.mockClear();
  useMatchImpl.mockClear();
  useRouteErrorImpl.mockClear();
};
