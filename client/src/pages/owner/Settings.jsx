import { useState, useRef, useEffect } from 'react';
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

  // Telegram bot link state
  const [tgBotName, setTgBotName] = useState('');
  const [tgLinks, setTgLinks] = useState([]);
  const [tgInviteLink, setTgInviteLink] = useState('');
  const [tgLoading, setTgLoading] = useState(false);

  useEffect(() => {
    api.get('/notifications/telegram-bot').then(({ data }) => {
      if (data.username) setTgBotName(data.username);
    }).catch(() => {});
    // Load linked Telegram accounts
    api.get('/notifications/telegram-links').then(({ data }) => {
      setTgLinks(data.links || []);
    }).catch(() => {});
  }, []);

  const generateTgInvite = async () => {
    setTgLoading(true);
    try {
      const { data } = await api.post('/notifications/telegram-invite');
      if (data.link) {
        setTgInviteLink(data.link);
        // Try sharing
        if (navigator.share) {
          await navigator.share({
            title: 'BizPOS Telegram',
            text: language === 'ha'
              ? 'Danna wannan hanyar haɗin yanar gizo don karɓar sanarwar saye ta Telegram:'
              : 'Tap this link to receive sale notifications via Telegram:',
            url: data.link,
          }).catch(() => {});
        }
      }
    } catch {
      setTgInviteLink('');
    }
    setTgLoading(false);
  };

  const removeTgLink = async (chatId) => {
    try {
      await api.delete(`/notifications/telegram-links/${chatId}`);
      setTgLinks((prev) => prev.filter((l) => l.chat_id !== chatId));
    } catch {}
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

        {/* Telegram Notifications */}
        <SectionTitle>{language === 'ha' ? 'Sanarwar Telegram' : 'Telegram Notifications'}</SectionTitle>
        <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 space-y-3">
          <p className="text-sm text-[var(--text-primary)]">
            {language === 'ha'
              ? 'Karbi sanarwar saye, duba kaya, da sarrafa farashi daga Telegram.'
              : 'Receive sale alerts, check stock, and manage prices from Telegram.'}
          </p>

          {/* ── Linked Telegram Accounts ── */}
          {tgLinks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                {language === 'ha' ? 'Asusun da aka hada:' : 'Linked accounts:'}
              </p>
              {tgLinks.map((link) => (
                <div key={link.chat_id} className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">&#128172;</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{link.user_name || 'Telegram User'}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">ID: {link.chat_id}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeTgLink(link.chat_id)}
                    className="shrink-0 text-xs text-red-500 font-medium px-2 py-1 rounded active:bg-red-500/10"
                  >
                    {language === 'ha' ? 'Cire' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tgLinks.length === 0 && (
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3 text-center">
              <p className="text-xs text-[var(--text-secondary)]">
                {language === 'ha' ? 'Babu wanda aka hada tukuna' : 'No Telegram accounts linked yet'}
              </p>
            </div>
          )}

          {/* ── Add New: Two Options ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              {language === 'ha' ? 'Hada sabon mutum:' : 'Add new person:'}
            </p>

            {/* Option 1: Open bot yourself */}
            {tgBotName && (
              <button
                onClick={() => window.open(`https://t.me/${tgBotName}`, '_blank')}
                className="w-full px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                <span>&#9993;</span>
                {language === 'ha' ? 'Bude Telegram Bot (Kanka)' : 'Open Telegram Bot (Yourself)'}
              </button>
            )}

            {/* Option 2: Send invite link to someone else */}
            <button
              onClick={generateTgInvite}
              disabled={tgLoading}
              className="w-full px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>&#128279;</span>
              {tgLoading
                ? '...'
                : language === 'ha'
                  ? 'Aika Hanyar Gayyata (Wani Mutum)'
                  : 'Send Invite Link (Someone Else)'}
            </button>

            {/* Show generated link for manual copy */}
            {tgInviteLink && (
              <div className="bg-[var(--bg-secondary)] rounded-lg p-2.5 space-y-1.5">
                <p className="text-[10px] font-semibold text-[var(--text-primary)]">
                  {language === 'ha' ? 'Hanyar gayyata (24 awa):' : 'Invite link (valid 24h):'}
                </p>
                <div
                  onClick={() => { navigator.clipboard?.writeText(tgInviteLink); }}
                  className="text-[11px] text-blue-400 font-mono break-all cursor-pointer active:opacity-50"
                >
                  {tgInviteLink}
                </div>
                <p className="text-[9px] text-[var(--text-secondary)]">
                  {language === 'ha' ? 'Danna don kwafa' : 'Tap to copy'}
                </p>
              </div>
            )}
          </div>

          {/* ── Manual instructions ── */}
          <details className="text-xs">
            <summary className="text-[var(--text-secondary)] cursor-pointer">
              {language === 'ha' ? 'Ko kuma hada da hannu...' : 'Or link manually...'}
            </summary>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3 mt-1.5 space-y-1">
              <p className="text-[var(--text-secondary)]">
                {language === 'ha' ? 'Aika wannan zuwa bot din: ' : 'Send this to the bot: '}
                <span className="font-mono text-[var(--text-primary)]">/start [phone] [PIN]</span>
              </p>
              <p className="text-[var(--text-secondary)]">
                {language === 'ha' ? 'Misali: ' : 'Example: '}
                <span className="font-mono text-[var(--text-primary)]">/start 08012345678 1234</span>
              </p>
            </div>
          </details>
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
