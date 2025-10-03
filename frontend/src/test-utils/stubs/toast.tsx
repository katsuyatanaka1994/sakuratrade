import React, { createContext, useContext } from 'react';
import { vi } from 'vitest';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
}

const showToastSpy = vi.fn<ToastContextValue['showToast']>();

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider = ({ children }: { children?: React.ReactNode }) => (
  <ToastContext.Provider value={{ showToast: showToastSpy }}>
    {children}
  </ToastContext.Provider>
);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider mock');
  }
  return ctx;
};

export const toastSpies = {
  showToast: showToastSpy,
};

export const resetToastStub = () => {
  showToastSpy.mockReset();
};

export default {
  ToastProvider,
  useToast,
  toastSpies,
  resetToastStub,
};
