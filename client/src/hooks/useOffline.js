import { useState, useEffect, useRef, useCallback } from 'react';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(!navigator.onLine);
  const lastOnlineAt = useRef(navigator.onLine ? Date.now() : null);
  const bannerTimer = useRef(null);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      lastOnlineAt.current = Date.now();
      // Show "back online" banner briefly then hide
      setShowBanner(true);
      clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setShowBanner(false), 3000);
    };
    const goOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      clearTimeout(bannerTimer.current);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearTimeout(bannerTimer.current);
    };
  }, []);

  const dismissBanner = useCallback(() => setShowBanner(false), []);

  return {
    isOnline,
    isOffline: !isOnline,
    showBanner,
    dismissBanner,
    lastOnlineAt: lastOnlineAt.current,
  };
}
