import { create } from 'zustand';
import api from '../api/client';

export const useSubscriptionStore = create((set, get) => ({
  plan: 'free',
  expiresAt: null,
  daysRemaining: 0,
  expired: false,
  loading: false,
  error: null,

  isPremium: () => get().plan === 'premium' && !get().expired,

  fetchPlan: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get('/subscription/plan');
      set({
        plan: data.plan,
        expiresAt: data.expiresAt,
        daysRemaining: data.daysRemaining,
        expired: data.expired,
        loading: false,
      });
      return data;
    } catch (err) {
      set({ loading: false, error: err?.response?.data?.error?.message || err.message });
      return null;
    }
  },

  redeemPin: async (pin) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/subscription/redeem', { pin });
      set({
        plan: data.plan,
        expiresAt: data.expiresAt,
        daysRemaining: data.daysAdded,
        expired: false,
        loading: false,
      });
      return data;
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err.message || 'Failed to activate';
      set({ loading: false, error: msg });
      throw new Error(msg);
    }
  },
}));
