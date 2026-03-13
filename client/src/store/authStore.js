import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/client';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null, // { id, name, role, businessId }
      isAuthenticated: false,
      loading: false,
      error: null,

      login: (token, refreshToken, user) =>
        set({ token, refreshToken, user, isAuthenticated: true }),

      loginWithCredentials: async (phone, pin) => {
        set({ loading: true, error: null });
        try {
          const { data } = await api.post('/auth/login', { phone, pin });
          get().login(data.token, data.refreshToken, data.user);
          return data.user;
        } catch (err) {
          const message = err?.response?.data?.message || err.message || 'Login failed';
          set({ error: message });
          throw new Error(message);
        } finally {
          set({ loading: false });
        }
      },

      logout: () =>
        set({ token: null, refreshToken: null, user: null, isAuthenticated: false }),

      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
