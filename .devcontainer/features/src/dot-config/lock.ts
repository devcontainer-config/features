export interface AsyncLock {
  invoke: <T>(f: () => Promise<T>) => Promise<T>;
}

export const createAsyncLock = (): AsyncLock => {
  const lock = { pending: Promise.resolve() };
  return {
    invoke: async <T>(f: () => Promise<T>) => {
      const pending = lock.pending;
      const resolver: { resolve?: () => void } = {};
      lock.pending = lock.pending.then(() => new Promise((resolve) => (resolver.resolve = resolve)));
      await pending;
      try {
        return await f();
      } finally {
        resolver.resolve!();
      }
    },
  };
};
