import "@testing-library/jest-dom/vitest";

// localStorage polyfill - jsdom doesn't properly initialize localStorage methods
if (typeof globalThis !== "undefined") {
  const store: Record<string, string> = {};

  const localStoragePolyfill: Storage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key]);
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
    get length() {
      return Object.keys(store).length;
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: localStoragePolyfill,
    writable: false,
  });
}
