import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { labelKey: 'sell', icon: '🛒', path: '/scan' },
    { labelKey: 'dashboard', icon: '📊', path: '/dashboard' },
    { labelKey: 'inventory', icon: '📦', path: '/inventory' },
    { labelKey: 'reports', icon: '📈', path: '/reports' },
    { labelKey: 'settings', icon: '⚙️', path: '/settings' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary,#fff)] border-t border-[var(--border-color,#e5e7eb)] z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex justify-around">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex flex-col items-center py-2 min-h-[52px] justify-center transition-all duration-150 ${
                active
                  ? 'text-[var(--accent)] relative'
                  : 'text-[var(--text-secondary)] active:bg-[var(--bg-primary)]'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--accent)]" />
              )}
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-semibold mt-0.5">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
