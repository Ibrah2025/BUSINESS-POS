import { useCallback } from 'react';
import { useSettingsStore } from '../store/settingsStore';

/**
 * Speaks the sale total aloud after a successful sale.
 * Uses browser TTS — zero cost, works offline on most devices.
 * Falls back silently if unsupported.
 */
export function useVoice() {
  const { language, soundEnabled } = useSettingsStore();

  const speakSaleComplete = useCallback(
    (amount) => {
      if (!soundEnabled || !window.speechSynthesis) return;

      // Cancel any queued speech
      speechSynthesis.cancel();

      const msg = new SpeechSynthesisUtterance();
      const formatted = Number(amount).toLocaleString();

      if (language === 'ha') {
        msg.text = `An kammala saye. Naira ${formatted}`;
        msg.lang = 'ha-NG';
      } else {
        msg.text = `Sale complete. ${formatted} Naira`;
        msg.lang = 'en-NG';
      }

      msg.rate = 1.1;
      msg.volume = 0.8;

      try {
        speechSynthesis.speak(msg);
      } catch {
        // silent fail — TTS not available
      }
    },
    [language, soundEnabled]
  );

  return { speakSaleComplete };
}
