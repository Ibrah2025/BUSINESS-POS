import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingsStore = create(
  persist(
    (set) => ({
      theme: 'premium', // 'premium' | 'dark' | 'bright' | 'neutral' | 'vivid'
      language: 'en', // 'en' | 'ha'
      soundEnabled: true,
      hapticEnabled: true,
      dataSaverMode: false,
      businessName: '',
      businessType: '',
      currency: '\u20A6', // Naira sign

      setTheme: (theme) => {
        if (typeof document !== 'undefined') {
          document.documentElement.dataset.theme = theme;
        }
        set({ theme });
      },

      setLanguage: (language) => set({ language }),

      toggleSound: () =>
        set((state) => ({ soundEnabled: !state.soundEnabled })),

      toggleHaptic: () =>
        set((state) => ({ hapticEnabled: !state.hapticEnabled })),

      toggleDataSaver: () =>
        set((state) => ({ dataSaverMode: !state.dataSaverMode })),

      setBusinessInfo: (info) =>
        set({
          ...(info.businessName !== undefined && { businessName: info.businessName }),
          ...(info.businessType !== undefined && { businessType: info.businessType }),
          ...(info.currency !== undefined && { currency: info.currency }),
        }),
    }),
    {
      name: 'settings-storage',
      onRehydrate: () => (state) => {
        if (state?.theme && typeof document !== 'undefined') {
          document.documentElement.dataset.theme = state.theme;
        }
      },
    }
  )
);
