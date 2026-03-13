import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTranslation } from '../i18n';

const SAVED_PHONE_KEY = 'bizpos_saved_phone';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const { t, language } = useTranslation();
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const { loginWithCredentials, loading, isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  // Auto-redirect if already logged in (session persisted)
  useEffect(() => {
    if (isAuthenticated && user) {
      const dest = user.role === 'attendant' ? '/scan' : '/dashboard';
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Pre-fill saved phone number
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_PHONE_KEY);
    if (saved) {
      setPhone(saved);
      setRemember(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone || pin.length !== 4) {
      setError(t('enter_phone_and_pin'));
      return;
    }

    try {
      const cleanPhone = phone.trim().replace(/^0+/, '');
      const fullPhone = cleanPhone.startsWith('+') ? cleanPhone : `+234${cleanPhone}`;

      if (remember) {
        localStorage.setItem(SAVED_PHONE_KEY, phone.trim());
      } else {
        localStorage.removeItem(SAVED_PHONE_KEY);
      }

      const loggedUser = await loginWithCredentials(fullPhone, pin);
      const dest = loggedUser?.role === 'attendant' ? '/scan' : '/dashboard';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err?.message || t('login_failed'));
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--bg-primary)] px-4">
      {/* Language toggle — top right */}
      <button
        onClick={() => setLanguage(language === 'ha' ? 'en' : 'ha')}
        className="fixed top-4 right-4 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)] active:bg-[var(--border-color)] z-10"
      >
        {language === 'ha' ? 'English' : 'Hausa'}
      </button>

      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-[var(--text-primary)] mb-1">
          {t('app_name')}
        </h1>
        <p className="text-center text-[var(--text-secondary)] mb-8 text-sm">
          {t('sign_in_subtitle')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('phone_number')}
            </label>
            <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--accent)]">
              <span className="px-3 py-3 text-base text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] select-none">+234</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="8012345678"
                className="flex-1 px-3 py-3 bg-transparent text-[var(--text-primary)] text-base outline-none placeholder:text-[var(--text-secondary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('pin')}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="****"
              className="w-full px-3 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-color)] accent-[var(--accent)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">
              {t('remember_me') || 'Remember me'}
            </span>
          </label>

          {error && (
            <p className="text-sm text-[var(--danger)] text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-base transition-colors disabled:opacity-50"
          >
            {loading ? t('signing_in') : t('sign_in')}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
          {t('new_business')}{' '}
          <a href="/onboarding" className="text-[var(--accent)] font-medium">
            {t('get_started')}
          </a>
        </p>
      </div>
    </div>
  );
}
