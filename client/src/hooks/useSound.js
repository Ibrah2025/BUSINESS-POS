import { useCallback } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { playBeep as _beep, playSuccess as _success, playError as _error } from '../utils/sound';

export function useSound() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);

  const playBeep = useCallback(() => { if (soundEnabled) _beep(); }, [soundEnabled]);
  const playSuccess = useCallback(() => { if (soundEnabled) _success(); }, [soundEnabled]);
  const playError = useCallback(() => { if (soundEnabled) _error(); }, [soundEnabled]);

  return { playBeep, playSuccess, playError };
}
