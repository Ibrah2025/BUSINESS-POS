import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../i18n';
import api from '../../api/client';

const ROLE_COLORS = {
  owner: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  attendant: 'bg-green-100 text-green-800',
};

function RoleBadge({ role, t }) {
  return (
    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${ROLE_COLORS[role] || ROLE_COLORS.attendant}`}>
      {t(role)}
    </span>
  );
}

function StatusDot({ active }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-[var(--success)]' : 'bg-gray-400'}`} />
  );
}

function StaffModal({ staff, onClose, onSave, onDeactivate, saving, t }) {
  const isEdit = !!staff?.id;
  const [name, setName] = useState(staff?.name || '');
  const [phone, setPhone] = useState((staff?.phone || '').replace(/^\+234/, ''));
  const [role, setRole] = useState(staff?.role || 'attendant');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError(t('name_required'));
    if (!phone.trim()) return setError(t('phone_required'));
    if (!isEdit && !pin) return setError(t('pin_required'));
    if (pin && pin.length !== 4) return setError(t('pin_must_be_4_digits'));
    if (pin && pin !== confirmPin) return setError(t('pins_do_not_match'));
    if (pin && !/^\d{4}$/.test(pin)) return setError(t('pin_must_be_4_digits'));

    const cleanPhone = phone.trim().replace(/^0+/, '');
    const fullPhone = cleanPhone.startsWith('+') ? cleanPhone : `+234${cleanPhone}`;
    const payload = { name: name.trim(), phone: fullPhone, role };
    if (pin) payload.pin = pin;
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[var(--card-bg)] rounded-t-2xl sm:rounded-2xl border border-[var(--border-color)] p-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
          {isEdit ? t('edit_staff') : t('add_staff')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-[var(--text-secondary)]">{t('name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">{t('phone')}</label>
            <div className="flex mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden focus-within:ring-1 focus-within:ring-[var(--accent)]">
              <span className="px-3 py-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-primary)] border-r border-[var(--border-color)] select-none">+234</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="8012345678"
                className="flex-1 bg-transparent text-[var(--text-primary)] px-3 py-2 text-sm outline-none placeholder:text-[var(--text-secondary)]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">{t('role')}</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              <option value="attendant">{t('attendant')}</option>
              <option value="manager">{t('manager')}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-secondary)]">{isEdit ? t('new_pin_optional') : t('pin')}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder={t('four_digits')}
                className="w-full mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--text-secondary)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)]">{t('confirm_pin')}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder={t('four_digits')}
                className="w-full mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--text-secondary)]"
              />
            </div>
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-40"
            >
              {saving ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-medium border border-[var(--border-color)]"
            >
              {t('cancel')}
            </button>
          </div>

          {isEdit && (
            <button
              type="button"
              onClick={() => onDeactivate(staff)}
              className="w-full mt-1 py-2 rounded-lg text-sm font-medium text-[var(--danger)] border border-[var(--danger)]/30"
            >
              {staff.active !== false ? t('deactivate') : t('reactivate')}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default function Staff() {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/auth/staff');
      setStaffList(Array.isArray(data) ? data : data.staff || []);
    } catch (err) {
      setError(err?.response?.data?.message || t('failed_load_staff'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const openAdd = () => {
    setEditingStaff(null);
    setModalOpen(true);
  };

  const openEdit = (member) => {
    setEditingStaff(member);
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editingStaff?.id) {
        await api.put(`/auth/staff/${editingStaff.id}`, payload);
      } else {
        await api.post('/auth/staff', payload);
      }
      setModalOpen(false);
      setEditingStaff(null);
      fetchStaff();
    } catch (err) {
      alert(err?.response?.data?.message || t('failed_to_save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (member) => {
    const newActive = member.active === false;
    try {
      await api.put(`/auth/staff/${member.id}`, { active: newActive });
      setModalOpen(false);
      setEditingStaff(null);
      fetchStaff();
    } catch (err) {
      alert(err?.response?.data?.message || t('failed_update_status'));
    }
  };

  if (user?.role !== 'owner') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <p className="text-[var(--danger)] text-sm font-medium">{t('owners_only')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-6">
      <header className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('staff')}</h1>
        <button
          onClick={openAdd}
          className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold"
        >
          + {t('add_staff')}
        </button>
      </header>

      <main className="px-4 py-4 max-w-3xl mx-auto space-y-3">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 p-4">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </div>
        )}

        {!loading && !error && staffList.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--text-secondary)] text-sm">{t('no_staff_yet')}</p>
          </div>
        )}

        {staffList.map((member) => (
          <button
            key={member.id || member._id}
            onClick={() => openEdit(member)}
            className="w-full text-left rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[var(--accent)]">
                {(member.name || '?')[0].toUpperCase()}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{member.name}</p>
                <StatusDot active={member.active !== false} />
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{member.phone}</p>
            </div>

            {/* Role + stats */}
            <div className="text-right shrink-0 space-y-1">
              <RoleBadge role={member.role} t={t} />
              {member.role === 'attendant' && member.todaySales != null && (
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {member.todaySales} {t('sales')} &middot; {member.todayTotal != null ? `₦${member.todayTotal.toLocaleString()}` : ''}
                </p>
              )}
            </div>
          </button>
        ))}
      </main>

      {modalOpen && (
        <StaffModal
          staff={editingStaff}
          onClose={() => { setModalOpen(false); setEditingStaff(null); }}
          onSave={handleSave}
          onDeactivate={handleDeactivate}
          saving={saving}
          t={t}
        />
      )}
    </div>
  );
}
