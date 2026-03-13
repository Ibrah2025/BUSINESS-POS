import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

function webVibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { }
}

/** Light tap — cart add, button press */
export async function hapticLight() {
  if (isNative) {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { }
  } else {
    webVibrate(30);
  }
}

/** Medium tap — general feedback */
export async function hapticMedium() {
  if (isNative) {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch { }
  } else {
    webVibrate(50);
  }
}

/** Sale complete — satisfying double-tap */
export async function hapticSuccess() {
  if (isNative) {
    try { await Haptics.notification({ type: NotificationType.Success }); } catch { }
  } else {
    webVibrate([100, 80, 100]);
  }
}

/** Error — long buzz */
export async function hapticError() {
  if (isNative) {
    try { await Haptics.notification({ type: NotificationType.Error }); } catch { }
  } else {
    webVibrate([200]);
  }
}
