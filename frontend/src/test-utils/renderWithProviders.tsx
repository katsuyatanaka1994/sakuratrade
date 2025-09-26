import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { ToastProvider } from '@/components/ToastContainer';

export interface ProvidersOptions extends Omit<RenderOptions, 'queries'> {
  initialState?: unknown;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { initialState, ...renderOptions }: ProvidersOptions = {},
) {
  void initialState; // reserved for future global state injection

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return <ToastProvider>{children}</ToastProvider>;
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
