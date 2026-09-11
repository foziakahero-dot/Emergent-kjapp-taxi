const hasLS = typeof localStorage !== 'undefined';

export const storage = {
  getItem: async (key: string) => (hasLS ? localStorage.getItem(key) : null),
  setItem: async (key: string, value: string) => {
    if (hasLS) localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (hasLS) localStorage.removeItem(key);
  },
};
