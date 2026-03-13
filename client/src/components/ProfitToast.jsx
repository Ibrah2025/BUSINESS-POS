import { useEffect } from 'react';
import { useTranslation } from '../i18n';

export default function ProfitToast({ profit, isVisible, onDismiss, currency = '\u20A6' }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-0 top-[30%] z-[60] flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto cursor-pointer"
        onClick={onDismiss}
        style={{ animation: 'profitPop 3.5s ease-out forwards' }}
      >
        <div className="relative">
          {/* Glow ring */}
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: 'radial-gradient(circle, rgba(34,197,94,0.4) 0%, transparent 70%)',
              transform: 'scale(1.5)',
              animation: 'profitGlow 1.5s ease-out forwards',
            }}
          />
          {/* Main badge */}
          <div className="relative bg-gradient-to-r from-green-600 to-emerald-500 text-white px-8 py-4 rounded-2xl shadow-2xl">
            <p className="text-[11px] uppercase tracking-widest opacity-80 text-center mb-0.5">
              {t('profit_prefix')}
            </p>
            <p className="text-2xl font-black text-center tabular-nums">
              +{currency}{(profit || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
