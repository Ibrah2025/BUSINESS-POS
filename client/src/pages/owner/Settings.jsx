import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { exportBackup, importBackup } from '../../utils/dataPortability';
import api from '../../api/client';
import { useTranslation } from '../../i18n';
import { connectESP32, disconnectESP32, isConnected, sendSMS, checkConnection } from '../../services/esp32';

const THEMES = [
  { key: 'classic', colors: 'bg-gradient-to-r from-white to-gray-200 border border-gray-300' },
  { key: 'premium', colors: 'bg-gradient-to-r from-amber-600 to-amber-800' },
  { key: 'dark', colors: 'bg-gradient-to-r from-gray-700 to-gray-900' },
  { key: 'bright', colors: 'bg-gradient-to-r from-sky-400 to-blue-500' },
  { key: 'neutral', colors: 'bg-gradient-to-r from-stone-400 to-stone-600' },
  { key: 'vivid', colors: 'bg-gradient-to-r from-fuchsia-500 to-violet-600' },
];

function Toggle({ enabled, onToggle, label, description }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>}
      </div>
      <button
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-green-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 mt-5 first:mt-0">{children}</h2>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const {
    theme, language, soundEnabled, hapticEnabled, dataSaverMode,
    businessName, businessType, currency,
    setTheme, setLanguage, toggleSound, toggleHaptic, toggleDataSaver, setBusinessInfo,
  } = useSettingsStore();
  const { t } = useTranslation();

  const THEME_LABELS = {
    classic: t('theme_classic'),
    premium: t('theme_premium'),
    dark: t('theme_dark'),
    bright: t('theme_bright'),
    neutral: t('theme_neutral'),
    vivid: t('theme_vivid'),
  };

  const [editName, setEditName] = useState(businessName);
  const [editType, setEditType] = useState(businessType);
  const [editCurrency, setEditCurrency] = useState(currency);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Notification settings (local state, saved to server)
  const [whatsapp, setWhatsapp] = useState(false);
  const [telegram, setTelegram] = useState(false);
  const [sms, setSms] = useState(false);
  const [notifPhone, setNotifPhone] = useState('');

  // WhatsApp Baileys state
  const [waStatus, setWaStatus] = useState({ state: 'disconnected', qrCode: null, connected: false, config: null });
  const [waPhone, setWaPhone] = useState('');
  const [waLoading, setWaLoading] = useState(false);
  const [waMsg, setWaMsg] = useState('');
  const [waMsgType, setWaMsgType] = useState(''); // 'success' | 'error'

  const fetchWaStatus = async () => {
    try {
      const { data } = await api.get('/whatsapp/status');
      setWaStatus(data);
      if (data.config?.recipient_phone) setWaPhone(data.config.recipient_phone);
    } catch {}
  };

  // Poll WhatsApp status on mount and when QR is showing
  useState(() => { fetchWaStatus(); });

  const handleWaConnect = async () => {
    setWaLoading(true);
    setWaMsg('');
    try {
      const { data } = await api.post('/whatsapp/connect');
      setWaStatus(data);
      // Poll for QR code / connection
      const poll = setInterval(async () => {
        const { data: s } = await api.get('/whatsapp/status');
        setWaStatus(s);
        if (s.connected || s.state === 'disconnected') clearInterval(poll);
      }, 3000);
      setTimeout(() => clearInterval(poll), 120000); // stop polling after 2 min
    } catch (err) {
      setWaMsg(t('connection_failed'));
      setWaMsgType('error');
    }
    setWaLoading(false);
  };

  const handleWaDisconnect = async () => {
    setWaLoading(true);
    try {
      await api.post('/whatsapp/disconnect');
      setWaStatus({ state: 'disconnected', qrCode: null, connected: false, config: null });
      setWaMsg(t('disconnected'));
      setWaMsgType('success');
    } catch {}
    setWaLoading(false);
  };

  const handleWaSavePhone = async () => {
    if (!waPhone.trim()) return;
    setWaLoading(true);
    setWaMsg('');
    try {
      await api.post('/whatsapp/set-recipient', { phone: waPhone.trim() });
      setWaMsg(t('saved'));
      setWaMsgType('success');
      setTimeout(() => setWaMsg(''), 2000);
    } catch {
      setWaMsg(t('failed_to_save'));
      setWaMsgType('error');
    }
    setWaLoading(false);
  };

  const handleWaTest = async () => {
    setWaLoading(true);
    setWaMsg('');
    try {
      const { data } = await api.post('/whatsapp/test');
      setWaMsg(data.sent ? (language === 'ha' ? 'An aika sako!' : 'Test message sent!') : (language === 'ha' ? 'Ba a aika ba' : 'Failed to send'));
      setWaMsgType(data.sent ? 'success' : 'error');
      setTimeout(() => setWaMsg(''), 3000);
    } catch {
      setWaMsg(t('failed'));
      setWaMsgType('error');
    }
    setWaLoading(false);
  };

  const [importMsg, setImportMsg] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  // ESP32 GSM state
  const [esp32Connected, setEsp32Connected] = useState(false);
  const [esp32Phone, setEsp32Phone] = useState(() => localStorage.getItem('esp32_phone') || '');
  const [esp32Status, setEsp32Status] = useState('');
  const [esp32Connecting, setEsp32Connecting] = useState(false);

  const handleConnectESP32 = async () => {
    setEsp32Connecting(true);
    setEsp32Status('');
    try {
      await connectESP32();
      setEsp32Connected(true);
      setEsp32Status(t('connected'));
    } catch (err) {
      setEsp32Connected(false);
      setEsp32Status(err.message || t('connection_failed'));
    }
    setEsp32Connecting(false);
  };

  const handleDisconnectESP32 = async () => {
    await disconnectESP32();
    setEsp32Connected(false);
    setEsp32Status(t('disconnected'));
  };

  const handleEsp32PhoneChange = (e) => {
    const val = e.target.value;
    setEsp32Phone(val);
    localStorage.setItem('esp32_phone', val);
  };

  const handleTestSMS = async () => {
    if (!esp32Phone.trim()) { setEsp32Status(t('enter_phone_number')); return; }
    setEsp32Status(t('sending_test_sms'));
    try {
      await sendSMS(esp32Phone.trim(), t('test_sms_body'));
      setEsp32Status(t('test_sms_sent'));
    } catch (err) {
      setEsp32Status(t('failed') + ': ' + (err.message || t('unknown')));
    }
  };

  const saveBusinessInfo = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      setBusinessInfo({ businessName: editName, businessType: editType, currency: editCurrency });
      await api.put('/business/settings', {
        businessName: editName,
        businessType: editType,
        currency: editCurrency,
        notifications: { whatsapp, telegram, sms, phone: notifPhone },
      });
      setSaveMsg(t('saved'));
      setSaveSuccess(true);
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg(t('failed_to_save'));
      setSaveSuccess(false);
    }
    setSaving(false);
  };

  const handleExportBackup = () => {
    const state = useSettingsStore.getState();
    exportBackup(state);
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg('');
    try {
      const data = await importBackup(file);
      if (data.businessName) setBusinessInfo({ businessName: data.businessName, businessType: data.businessType, currency: data.currency });
      setImportMsg(t('backup_imported'));
      setImportSuccess(true);
    } catch (err) {
      setImportMsg(err.message);
      setImportSuccess(false);
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-6">
      <header className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('settings')}</h1>
      </header>

      <main className="px-4 py-4 max-w-3xl mx-auto">
        {/* Business Info */}
        <SectionTitle>{t('business_name')}</SectionTitle>
        <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 space-y-3">
          <div>
            <label className="text-xs text-[var(--text-secondary)]">{t('business_name')}</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">{t('business_type')}</label>
            <input
              type="text"
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              placeholder={t('business_type_placeholder')}
              className="w-full mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--text-secondary)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">{t('currency')}</label>
            <input
              type="text"
              value={editCurrency}
              onChange={(e) => setEditCurrency(e.target.value)}
              className="w-full mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveBusinessInfo}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-40"
            >
              {saving ? t('saving') : t('save')}
            </button>
            {saveMsg && (
              <span className={`text-sm ${saveSuccess ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{saveMsg}</span>
            )}
          </div>
        </div>

        {/* Appearance */}
        <SectionTitle>{t('theme')}</SectionTitle>
        <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4">
          <p className="text-sm text-[var(--text-primary)] mb-3">{t('theme')}</p>
          <div className="flex gap-2 flex-wrap">
            {THEMES.map((th) => (
              <button
                key={th.key}
                onClick={() => setTheme(th.key)}
                className={`flex flex-col items-center gap-1`}
              >
                <div className={`w-12 h-12 rounded-xl ${th.colors} ${theme === th.key ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--card-bg)]' : ''}`} />
                <span className={`text-[10px] font-medium ${theme === th.key ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                  {THEME_LABELS[th.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <SectionTitle>{t('language')}</SectionTitle>
        <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4">
          <div className="flex gap-2">
            {[{ key: 'en', label: t('lang_english') }, { key: 'ha', label: t('lang_hausa') }].map((l) => (
              <button
                key={l.key}
                onClick={() => setLanguage(l.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  language === l.key
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-color)]'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <SectionTitle>{t('settings')}</SectionTitle>
        <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] px-4 divide-y divide-[var(--border-color)]">
          <Toggle label={t('sound_effects')} enabled={soundEnabled} onToggle={toggleSound} />
          <Toggle label={t('haptic_feedback')} description={t('haptic_feedback_hint')} enabled={hapticEnabled} onToggle={toggleHaptic} />
          <Toggle
            label={t('data_saver')}
            description={t('data_saver_hint')}
            enabled={dataSaverMode}
            onToggle={toggleDataSaver}
          />
        </div>

        {/* WhatsApp Notifications */}
        <SectionTitle>{language === 'ha' ? 'Sanarwar WhatsApp' : 'WhatsApp Notifications'}</SectionTitle>
        <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 space-y-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <span className={`inline-block w-3 h-3 rounded-full ${
              waStatus.connected ? 'bg-green-500' : waStatus.state === 'qr' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {waStatus.connected
                ? (language === 'ha' ? 'An hada WhatsApp' : 'WhatsApp Connected')
                : waStatus.state === 'qr'
                  ? (language === 'ha' ? 'Scan QR code...' : 'Scan QR code...')
                  : waStatus.state === 'connecting'
                    ? (language === 'ha' ? 'Ana hadawa...' : 'Connecting...')
                    : (language === 'ha' ? 'Ba a hada ba' : 'Not Connected')
              }
            </span>
          </div>

          {/* QR Code Display */}
          {waStatus.state === 'qr' && waStatus.qrCode && (
            <div className="flex flex-col items-center gap-2 py-2">
              <img src={waStatus.qrCode} alt="WhatsApp QR" className="w-56 h-56 rounded-lg border border-[var(--border-color)]" />
              <p className="text-xs text-[var(--text-secondary)] text-center">
                {language === 'ha'
                  ? 'Bude WhatsApp > Hadaddun na\'urori > Hada na\'ura'
                  : 'Open WhatsApp > Linked Devices > Link a Device'}
              </p>
            </div>
          )}

          {/* Connect / Disconnect Button */}
          {!waStatus.connected ? (
            <button
              onClick={handleWaConnect}
              disabled={waLoading || waStatus.state === 'qr'}
              className="w-full px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-40"
            >
              {waLoading ? (language === 'ha' ? 'Ana hadawa...' : 'Connecting...') : (language === 'ha' ? 'Hada WhatsApp' : 'Connect WhatsApp')}
            </button>
          ) : (
            <>
              {/* Recipient Phone */}
              <div>
                <label className="text-xs text-[var(--text-secondary)]">
                  {language === 'ha' ? 'Lambar waya mai karba' : 'Recipient phone number'}
                </label>
                <input
                  type="tel"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="08012345678"
                  className="w-full mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--text-secondary)]"
                />
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                  {language === 'ha'
                    ? 'Lambar waya da za a aika sanarwar saye'
                    : 'Phone number that will receive sale alerts'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleWaSavePhone}
                  disabled={waLoading || !waPhone.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-40"
                >
                  {language === 'ha' ? 'Ajiye' : 'Save'}
                </button>
                <button
                  onClick={handleWaTest}
                  disabled={waLoading}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-40"
                >
                  {language === 'ha' ? 'Gwada' : 'Test'}
                </button>
              </div>

              <button
                onClick={handleWaDisconnect}
                disabled={waLoading}
                className="w-full px-4 py-2 rounded-lg bg-red-600/10 text-red-600 text-sm font-medium border border-red-600/20"
              >
                {language === 'ha' ? 'Cire WhatsApp' : 'Disconnect WhatsApp'}
              </button>
            </>
          )}

          {waMsg && (
            <p className={`text-sm ${waMsgType === 'success' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{waMsg}</p>
          )}
        </div>

        {/* ESP32 GSM Module */}
        <SectionTitle>{t('esp32_gsm_module')}</SectionTitle>
        <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            {t('esp32_description')}
          </p>
          <div className="flex items-center gap-2">
            {esp32Connected ? (
              <button
                onClick={handleDisconnectESP32}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium"
              >
                {t('disconnect_esp32')}
              </button>
            ) : (
              <button
                onClick={handleConnectESP32}
                disabled={esp32Connecting}
                className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-40"
              >
                {esp32Connecting ? t('connecting') : t('connect_esp32')}
              </button>
            )}
            <span className={`inline-block w-3 h-3 rounded-full ${esp32Connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-[var(--text-secondary)]">{esp32Connected ? t('connected') : t('disconnected')}</span>
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">{t('owner_phone_sms_alerts')}</label>
            <input
              type="tel"
              value={esp32Phone}
              onChange={handleEsp32PhoneChange}
              placeholder="+234..."
              className="w-full mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--text-secondary)]"
            />
          </div>
          <button
            onClick={handleTestSMS}
            disabled={!esp32Connected}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-40"
          >
            {t('send_test_sms')}
          </button>
          {esp32Status && (
            <p className={`text-sm ${esp32Status.includes('fail') || esp32Status.includes('Failed') ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>{esp32Status}</p>
          )}
        </div>

        {/* Staff Management */}
        <SectionTitle>{t('team')}</SectionTitle>
        <button
          onClick={() => navigate('/staff')}
          className="w-full rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] px-4 py-3 text-left flex items-center justify-between"
        >
          <span className="text-sm font-medium text-[var(--text-primary)]">{t('staff_management')}</span>
          <span className="text-[var(--text-secondary)]">&gt;</span>
        </button>

        {/* Data */}
        <SectionTitle>{t('data')}</SectionTitle>
        <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={handleExportBackup}
              className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
            >
              {t('export_backup')}
            </button>
            <button
              onClick={() => fileInput.current?.click()}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-medium border border-[var(--border-color)]"
            >
              {t('import_backup')}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </div>
          {importMsg && (
            <p className={`text-sm ${importSuccess ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{importMsg}</p>
          )}
        </div>

        {/* About */}
        <SectionTitle>{t('about')}</SectionTitle>
        <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 space-y-1">
          <p className="text-sm text-[var(--text-primary)]">{t('app_name')} <span className="text-[var(--text-secondary)]">{t('version')}</span></p>
          <p className="text-xs text-[var(--text-secondary)]">{t('support_email')}</p>
          <button
            onClick={() => {
              const msg = encodeURIComponent(t(language === 'ha' ? 'share_app_message_ha' : 'share_app_message_en'));
              window.open(`https://wa.me/?text=${msg}`, '_blank');
            }}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mt-3"
          >
            📲 {t('share_app')}
          </button>
        </div>

        {/* Sign Out */}
        <button
          onClick={async () => {
            try { await api.post('/auth/logout'); } catch {}
            useAuthStore.getState().logout();
            navigate('/login');
          }}
          className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors mt-4"
        >
          {t('sign_out')}
        </button>

        <div className="h-6" />
      </main>
    </div>
  );
}
