import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Default to Hausa for Nigerian market; English only if phone is clearly non-Hausa
function detectDefaultLanguage() {
  try {
    const nav = navigator.language || navigator.userLanguage || '';
    // If phone is set to English with non-Nigerian locale, use English
    if (nav.startsWith('en') && !nav.includes('NG')) return 'en';
    // Everything else (including ha, ha-NG, en-NG, yo, ig) defaults to Hausa
    return 'ha';
  } catch {
    return 'ha';
  }
}

export const useSettingsStore = create(
  persist(
    (set) => ({
      theme: 'premium', // 'premium' | 'dark' | 'bright' | 'neutral' | 'vivid'
      language: detectDefaultLanguage(), // 'en' | 'ha'
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
