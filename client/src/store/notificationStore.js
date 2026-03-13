import { create } from 'zustand';

export const useNotificationStore = create((set) => ({
  liveFeed: [], // recent transactions for owner view, max 50
  unreadCount: 0,

  addTransaction: (tx) =>
    set((state) => ({
      liveFeed: [
        { ...tx, timestamp: tx.timestamp || Date.now() },
        ...state.liveFeed,
      ].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    })),

  clearFeed: () => set({ liveFeed: [], unreadCount: 0 }),

  markRead: () => set({ unreadCount: 0 }),
}));
