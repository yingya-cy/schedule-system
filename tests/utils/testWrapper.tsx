import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

interface WrapperOptions {
  route?: string;
}

export function createTestWrapper(_options?: WrapperOptions) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <BrowserRouter>{children}</BrowserRouter>;
  };
}
