import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTranslation } from '../i18n';
import api from '../api/client';

export default function Onboarding() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const setBusinessInfo = useSettingsStore((s) => s.setBusinessInfo);
  const { t } = useTranslation();

  const [langChosen, setLangChosen] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const storeSetLanguage = useSettingsStore((s) => s.setLanguage);
  const pickLanguage = (lang) => {
    storeSetLanguage(lang);
    setLangChosen(true);
  };

  const handleSubmit = async () => {
    setError('');
    if (!businessName.trim()) return setError(t('business_name_required'));
    if (!ownerName.trim()) return setError(t('owner_name_required'));
    if (!phone || phone.length < 10) return setError(t('enter_valid_phone'));
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return setError(t('pin_must_be_4_digits'));
    if (pin !== confirmPin) return setError(t('pins_do_not_match'));

    setSubmitting(true);
    try {
      const fullPhone = `+234${phone.replace(/^0+/, '')}`;
      const { data } = await api.post('/auth/register', {
        ownerName: ownerName.trim(),
        phone: fullPhone,
        pin,
        businessName: businessName.trim(),
        businessType: 'retail',
        currency: '₦',
      });

      login(data.token, data.refreshToken, data.user);
      setBusinessInfo({ businessName: businessName.trim(), businessType: 'retail', currency: '₦' });

      // Skip products/notifications — they can add from Inventory & Settings
      try { await api.post('/business/onboarding', { products: [], notifications: {} }); } catch {}

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('setup_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500 text-base';

  // ── Screen 1: Language ──
  if (!langChosen) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-4">
        <h1 className="text-3xl font-black text-[var(--text-primary)] mb-2">BizPOS</h1>
        <p className="text-[var(--text-secondary)] mb-10 text-sm">Choose your language / Zaɓi harshenka</p>

        <div className="w-full max-w-xs space-y-4">
          <button
            onClick={() => pickLanguage('ha')}
            className="w-full py-4 rounded-xl bg-green-600 text-white font-bold text-lg active:bg-green-700 transition-colors"
          >
            Hausa
          </button>
          <button
            onClick={() => pickLanguage('en')}
            className="w-full py-4 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] font-bold text-lg border border-[var(--border-color)] active:bg-[var(--border-color)] transition-colors"
          >
            English
          </button>
        </div>
      </div>
    );
  }

  // ── Screen 2: Single form ──
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-8">
      <div className="w-full max-w-sm mx-auto">
        <h1 className="text-2xl font-bold text-center text-[var(--text-primary)] mb-1">
          {t('app_name')}
        </h1>
        <p className="text-center text-[var(--text-secondary)] mb-6 text-sm">
          {t('setup_business')}
        </p>

        <div className="bg-[var(--card-bg,var(--bg-secondary))] rounded-xl p-5 border border-[var(--border-color)] space-y-4">
          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('business_name')}
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t('business_name_placeholder')}
              className={inputCls}
            />
          </div>

          {/* Owner Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('owner_name')}
            </label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder={t('full_name')}
              className={inputCls}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('phone_number')}
            </label>
            <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] overflow-hidden focus-within:ring-2 focus-within:ring-green-500">
              <span className="px-3 py-3 text-base text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] select-none">+234</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="8012345678"
                className="flex-1 px-3 py-3 bg-transparent text-[var(--text-primary)] text-base outline-none"
              />
            </div>
          </div>

          {/* PIN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {t('set_pin')}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className={`${inputCls} text-center text-2xl tracking-[0.5em]`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {t('confirm_pin')}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className={`${inputCls} text-center text-2xl tracking-[0.5em]`}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-[var(--danger,#ef4444)] text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-base transition-colors disabled:opacity-50"
          >
            {submitting ? t('setting_up') : t('start_selling')}
          </button>
        </div>

        <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
          {t('already_have_account')}{' '}
          <a href="/login" className="text-green-600 font-medium">
            {t('sign_in')}
          </a>
        </p>
      </div>
    </div>
  );
}
