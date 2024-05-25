export interface AsyncLock {
  invoke: <T>(f: () => Promise<T>) => Promise<T>;
}

export const createAsyncLock = (): AsyncLock => {
  const lock = {
    isLocked: false,
    pending: Promise.resolve(),
  };
  return {
    invoke: async <T>(f: () => Promise<T>) => {
      while (lock.isLocked) {
        await lock.pending;
      }
      lock.isLocked = true;
      const resolver: { resolve?: () => void } = {};
      try {
        lock.pending = new Promise((resolve) => (resolver.resolve = resolve));
        return await f();
      } finally {
        lock.isLocked = false;
        resolver.resolve?.();
      }
    },
  };
};
