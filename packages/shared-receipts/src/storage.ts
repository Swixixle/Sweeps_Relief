import type { DefenseReceipt } from "./types.js";

const MAX_STORED = 500;

export type ReceiptStorage = {
  get(): Promise<DefenseReceipt[]>;
  append(r: DefenseReceipt): Promise<void>;
  clear(): Promise<void>;
};

/** In-memory ring buffer for tests and non-persistent tooling. */
export function createMemoryReceiptStorage(): ReceiptStorage & { all: DefenseReceipt[] } {
  const all: DefenseReceipt[] = [];
  return {
    all,
    async get() {
      return [...all];
    },
    async append(r) {
      all.push(r);
      while (all.length > MAX_STORED) all.shift();
    },
    async clear() {
      all.length = 0;
    },
  };
}
