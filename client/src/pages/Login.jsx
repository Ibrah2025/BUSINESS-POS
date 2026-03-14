import { useState, useEffect, useRef } from 'react';
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
  const [activeField, setActiveField] = useState('phone'); // 'phone' | 'pin'
  const { t, language } = useTranslation();
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const phoneRef = useRef(null);
  const pinRef = useRef(null);

  const { loginWithCredentials, loading, isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      const dest = user.role === 'attendant' ? '/scan' : '/dashboard';
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const saved = localStorage.getItem(SAVED_PHONE_KEY);
    if (saved) {
      setPhone(saved);
      setRemember(true);
    }
  }, []);

  const doLogin = async () => {
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

  const handleSubmit = (e) => {
    e.preventDefault();
    doLogin();
  };

  // Custom keypad handler
  const onKey = (key) => {
    if (key === 'backspace') {
      if (activeField === 'phone') setPhone((p) => p.slice(0, -1));
      else setPin((p) => p.slice(0, -1));
    } else if (key === 'enter') {
      if (activeField === 'phone') {
        setActiveField('pin');
      } else {
        doLogin();
      }
    } else {
      if (activeField === 'phone') {
        setPhone((p) => p + key);
      } else {
        setPin((p) => (p.length < 4 ? p + key : p));
      }
    }
  };

  const keyBtnCls = 'flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] text-lg font-bold active:bg-[var(--accent)] active:text-white transition-colors select-none';

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-[var(--bg-primary)]">
      {/* Language toggle */}
      <button
        onClick={() => setLanguage(language === 'ha' ? 'en' : 'ha')}
        className="fixed top-4 right-4 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)] active:bg-[var(--border-color)] z-10"
      >
        {language === 'ha' ? 'English' : 'Hausa'}
      </button>

      {/* Form area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-16 pb-2">
        <div className="w-full max-w-sm mx-auto min-h-full flex flex-col justify-end">
          <h1 className="text-lg font-bold text-center text-[var(--text-primary)] mb-0.5">
            {t('app_name')}
          </h1>
          <p className="text-center text-[var(--text-secondary)] mb-2 text-[11px]">
            {t('sign_in_subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-1.5">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                {t('phone_number')}
              </label>
              <div
                onClick={() => setActiveField('phone')}
                className={`flex rounded-lg border-2 bg-[var(--input-bg)] overflow-hidden ${activeField === 'phone' ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'}`}
              >
                <span className="px-3 py-1.5 text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] select-none">+234</span>
                <input
                  ref={phoneRef}
                  type="text"
                  readOnly
                  value={phone}
                  onFocus={() => setActiveField('phone')}
                  placeholder="8012345678"
                  className="flex-1 px-3 py-1.5 bg-transparent text-[var(--text-primary)] text-sm outline-none placeholder:text-[var(--text-secondary)] caret-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                {t('pin')}
              </label>
              <input
                ref={pinRef}
                type="password"
                readOnly
                value={pin}
                onFocus={() => setActiveField('pin')}
                onClick={() => setActiveField('pin')}
                placeholder="****"
                className={`w-full px-3 py-1.5 rounded-lg border-2 bg-[var(--input-bg)] text-[var(--text-primary)] text-center text-lg tracking-[0.45em] outline-none caret-transparent ${activeField === 'pin' ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'}`}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border-color)] accent-[var(--accent)]"
              />
              <span className="text-[11px] text-[var(--text-secondary)]">
                {t('remember_me') || 'Remember me'}
              </span>
            </label>

            {error && (
              <p className="text-xs text-[var(--danger)] text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? t('signing_in') : t('sign_in')}
            </button>
          </form>

          <p className="text-center text-[11px] text-[var(--text-secondary)] mt-1.5">
            {t('new_business')}{' '}
            <a href="/onboarding" className="text-[var(--accent)] font-medium">
              {t('get_started')}
            </a>
          </p>
        </div>
      </div>

      {/* Custom large keypad */}
      <div className="shrink-0 w-full px-3 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        <div className="w-full max-w-sm mx-auto grid grid-cols-3 gap-1.5">
          {['1','2','3','4','5','6','7','8','9'].map((k) => (
            <button key={k} type="button" onClick={() => onKey(k)} className={`${keyBtnCls} h-11`}>
              {k}
            </button>
          ))}
          <button type="button" onClick={() => onKey('backspace')} className={`${keyBtnCls} h-11 text-red-400`}>
            &#9003;
          </button>
          <button type="button" onClick={() => onKey('0')} className={`${keyBtnCls} h-11`}>
            0
          </button>
          <button type="button" onClick={() => onKey('enter')} className={`${keyBtnCls} h-11 bg-[var(--accent)] text-white`}>
            &#10003;
          </button>
        </div>
      </div>
    </div>
  );
}
