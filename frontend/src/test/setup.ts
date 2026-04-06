import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// happy-dom doesn't provide window.confirm
if (typeof window !== 'undefined' && !window.confirm) {
  window.confirm = () => true;
}

afterEach(() => {
  cleanup();
});
