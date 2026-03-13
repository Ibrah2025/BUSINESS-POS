import { useState, useEffect, useMemo } from 'react';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../i18n';
import api from '../../api/client';

const STATUS_COLORS = {
  Paid: 'bg-green-100 text-green-800',
  Partial: 'bg-yellow-100 text-yellow-800',
  Pending: 'bg-blue-100 text-blue-800',
  Overdue: 'bg-red-100 text-red-800',
};

const STATUS_KEYS = {
  Paid: 'paid',
  Partial: 'partial',
  Pending: 'pending',
  Overdue: 'overdue',
};

function getStatus(credit) {
  if (credit.balance <= 0) return 'Paid';
  if (credit.balance < credit.amount) return 'Partial';
  if (credit.dueDate && new Date(credit.dueDate) < new Date()) return 'Overdue';
  return 'Pending';
}

function isDueSoon(credit) {
  if (!credit.dueDate || getStatus(credit) === 'Paid') return false;
  const diff = new Date(credit.dueDate) - new Date();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

function formatCurrency(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG');
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Credits() {
  const { customerCredits, supplierCredits, addCredit, updateCredit, setFinancialData } = useFinanceStore();
  const { businessName } = useSettingsStore();
  const { t } = useTranslation();
  const [tab, setTab] = useState('customer');
  const [expandedId, setExpandedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(null); // credit object or null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/credits');
        setFinancialData({
          customerCredits: data.customerCredits ?? data.filter?.(c => c.type === 'customer') ?? [],
          supplierCredits: data.supplierCredits ?? data.filter?.(c => c.type === 'supplier') ?? [],
        });
      } catch (err) {
        console.error('Failed to fetch credits:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [setFinancialData]);

  const credits = tab === 'customer' ? customerCredits : supplierCredits;

  const totalOwedToYou = useMemo(
    () => customerCredits.reduce((s, c) => s + (c.balance ?? 0), 0),
    [customerCredits]
  );
  const totalYouOwe = useMemo(
    () => supplierCredits.reduce((s, c) => s + (c.balance ?? 0), 0),
    [supplierCredits]
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)] border-b border-[var(--border)]">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('credits')}</h1>
        </div>

        {/* Tab toggle */}
        <div className="flex px-4 gap-2 pb-3">
          {['customer', 'supplier'].map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => { setTab(tabKey); setExpandedId(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === tabKey
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
              }`}
            >
              {tabKey === 'customer' ? t('customer_debts') : t('supplier_debts')}
            </button>
          ))}
        </div>

        {/* Summary bar */}
        <div className="flex px-4 gap-3 pb-3">
          <div className="flex-1 bg-green-50 rounded-lg p-2.5 text-center">
            <p className="text-xs text-green-700 font-semibold">{t('total_owed_to_you')}</p>
            <p className="text-[10px] text-green-600 leading-tight">{t('total_owed_to_you_hint')}</p>
            <p className="text-base font-bold text-green-800 mt-1">{formatCurrency(totalOwedToYou)}</p>
          </div>
          <div className="flex-1 bg-red-50 rounded-lg p-2.5 text-center">
            <p className="text-xs text-red-700 font-semibold">{t('total_you_owe')}</p>
            <p className="text-[10px] text-red-600 leading-tight">{t('total_you_owe_hint')}</p>
            <p className="text-base font-bold text-red-800 mt-1">{formatCurrency(totalYouOwe)}</p>
          </div>
        </div>
      </div>

      {/* Add Credit Button */}
      <div className="px-4 pt-3">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-semibold text-sm"
        >
          + {t('add_credit')}
        </button>
      </div>

      {/* Credit list */}
      <div className="px-4 pt-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-7 h-7 border-4 border-[var(--accent)] border-t-transparent rounded-full" />
          </div>
        ) : credits.length === 0 ? (
          <p className="text-center text-[var(--text-secondary)] py-12 text-sm">
            {t('no_credits')}
          </p>
        ) : (
          credits.map((credit) => {
            const status = getStatus(credit);
            const dueSoon = isDueSoon(credit);
            const expanded = expandedId === credit.id;

            return (
              <div
                key={credit.id}
                className={`rounded-xl border transition-colors ${
                  status === 'Overdue'
                    ? 'border-red-300 bg-red-50/50'
                    : dueSoon
                    ? 'border-yellow-300 bg-yellow-50/50'
                    : 'border-[var(--border)] bg-[var(--bg-secondary)]'
                }`}
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : credit.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)] text-sm">{credit.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{credit.phone || '—'}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                      {t(STATUS_KEYS[status])}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <p className="text-xs text-[var(--text-secondary)]">{t('total')}: {formatCurrency(credit.amount)}</p>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        {t('balance')}: {formatCurrency(credit.balance)}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{t('due_date')}: {formatDate(credit.dueDate)}</p>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-[var(--border)] p-3 space-y-3">
                    {credit.description && (
                      <div>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase">{t('items')}</p>
                        <p className="text-xs text-[var(--text-primary)] mt-0.5">{credit.description}</p>
                      </div>
                    )}

                    {credit.payments?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase mb-1">
                          {t('payment_history')}
                        </p>
                        <div className="space-y-1.5">
                          {credit.payments.map((p, i) => (
                            <div key={p.id || i} className="flex items-center justify-between text-xs bg-[var(--bg-primary)] rounded-lg px-2.5 py-1.5">
                              <div>
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {formatCurrency(p.amount)}
                                </span>
                                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  p.method === 'cash'
                                    ? 'bg-green-100 text-green-700'
                                    : p.method === 'transfer'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {t(p.method)}
                                </span>
                              </div>
                              <span className="text-[var(--text-secondary)]">{formatDate(p.date)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {status !== 'Paid' && (
                        <button
                          onClick={() => setPaymentModal(credit)}
                          className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold"
                        >
                          {t('record_payment')}
                        </button>
                      )}
                      <button
                        className="flex-1 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold"
                      >
                        {t('send_reminder')}
                      </button>
                      {credit.type === 'customer' && credit.phone && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const msg = encodeURIComponent(
                              t('debt_reminder_message')
                                .replace('{name}', credit.name)
                                .replace('{amount}', formatCurrency(credit.balanceRemaining || credit.balance))
                                .replace('{business}', businessName || 'our shop')
                            );
                            const phone = credit.phone.replace(/^0/, '234');
                            window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                          }}
                          className="px-2 py-1 text-[10px] font-medium text-green-700 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100"
                        >
                          📱 {t('send_whatsapp_reminder')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <PaymentModal
          credit={paymentModal}
          onClose={() => setPaymentModal(null)}
          onSuccess={(updated) => {
            updateCredit(updated.id, updated);
            setPaymentModal(null);
          }}
        />
      )}

      {/* Add Credit Modal */}
      {showAddModal && (
        <AddCreditModal
          defaultType={tab}
          onClose={() => setShowAddModal(false)}
          onSuccess={(credit) => {
            addCredit(credit);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

/* ─── Payment Modal (supports single + split) ─── */
function PaymentModal({ credit, onClose, onSuccess }) {
  const { bankAccounts } = useFinanceStore();
  const { t } = useTranslation();
  const [mode, setMode] = useState('single'); // 'single' | 'split'
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [bankId, setBankId] = useState(bankAccounts[0]?.id || '');
  // Split fields
  const [cashAmount, setCashAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [splitBankId, setSplitBankId] = useState(bankAccounts[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);

  const numAmount = mode === 'single'
    ? (Number(amount) || 0)
    : (Number(cashAmount) || 0) + (Number(bankAmount) || 0);
  const remaining = Math.max(0, (credit.balance ?? 0) - numAmount);

  async function handleSubmit(e) {
    e.preventDefault();
    if (numAmount <= 0 || numAmount > credit.balance) return;
    setSubmitting(true);
    try {
      let payload;
      if (mode === 'split') {
        const payments = [];
        if (Number(cashAmount) > 0) payments.push({ amount: Number(cashAmount), method: 'cash' });
        if (Number(bankAmount) > 0) payments.push({ amount: Number(bankAmount), method: 'bank', bankAccountId: splitBankId });
        payload = { payments };
      } else {
        payload = { amount: numAmount, method, ...(method === 'bank' && { bankAccountId: bankId }) };
      }
      const { data } = await api.post(`/credits/${credit.id}/payment`, payload);
      onSuccess(data);
    } catch (err) {
      console.error('Payment failed:', err);
      alert(t('payment_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[var(--bg-primary)] rounded-t-2xl p-5 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('record_payment')}</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] text-xl leading-none">&times;</button>
        </div>

        <p className="text-sm text-[var(--text-secondary)]">
          {credit.name} — {t('balance')}: <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(credit.balance)}</span>
        </p>

        {/* Single vs Split toggle */}
        <div className="flex gap-2">
          {['single', 'split'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === m
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]'
              }`}
            >
              {m === 'single' ? t('payment') : t('split')}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'single' ? (
            <>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">{t('amount')}</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={credit.balance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(String(credit.balance))}
                    className="px-3 py-2 rounded-lg bg-green-100 text-green-800 text-xs font-semibold whitespace-nowrap"
                  >
                    {t('pay_full')}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">{t('payment_method')}</label>
                <div className="flex gap-3 mt-1">
                  {['cash', 'bank', 'transfer'].map((m) => (
                    <label key={m} className="flex items-center gap-1.5 text-sm text-[var(--text-primary)] cursor-pointer">
                      <input
                        type="radio"
                        name="payMethod"
                        value={m}
                        checked={method === m}
                        onChange={() => setMethod(m)}
                        className="accent-[var(--accent)]"
                      />
                      {t(m)}
                    </label>
                  ))}
                </div>
              </div>

              {(method === 'bank' || method === 'transfer') && bankAccounts.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)]">{t('bank_account')}</label>
                  <select
                    value={bankId}
                    onChange={(e) => setBankId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} — {b.bank}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-[10px] text-[var(--text-secondary)]">{t('split_hint')}</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-[var(--text-secondary)] uppercase">{t('cash')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-[var(--text-secondary)] uppercase">{t('bank')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={bankAmount}
                    onChange={(e) => setBankAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
              </div>
              {Number(bankAmount) > 0 && bankAccounts.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)]">{t('bank_account')}</label>
                  <select
                    value={splitBankId}
                    onChange={(e) => setSplitBankId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} — {b.bank}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <p className="text-xs text-[var(--text-secondary)]">
            {t('remaining')}: <span className="font-semibold">{formatCurrency(remaining)}</span>
          </p>

          <button
            type="submit"
            disabled={submitting || numAmount <= 0}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? t('processing') : t('confirm_payment')}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Add Credit Modal ─── */
function AddCreditModal({ defaultType, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [type, setType] = useState(defaultType);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !amount) return;
    setSubmitting(true);
    try {
      const payload = {
        type,
        name,
        phone,
        amount: Number(amount),
        balance: Number(amount),
        dueDate: dueDate || null,
        description,
      };
      const { data } = await api.post('/credits', payload);
      onSuccess(data);
    } catch (err) {
      console.error('Failed to add credit:', err);
      alert(t('failed_to_save'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[var(--bg-primary)] rounded-t-2xl p-5 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('add_credit')}</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">{t('type')}</label>
            <div className="flex gap-3 mt-1">
              {['customer', 'supplier'].map((tabKey) => (
                <label key={tabKey} className="flex items-center gap-1.5 text-sm text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="radio"
                    name="creditType"
                    value={tabKey}
                    checked={type === tabKey}
                    onChange={() => setType(tabKey)}
                    className="accent-[var(--accent)]"
                  />
                  {tabKey === 'customer' ? t('customer') : t('supplier')}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">{t('name')} *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">{t('phone')}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">{t('amount')} *</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">{t('due_date')}</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">{t('items_description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? t('saving') : t('save_credit')}
          </button>
        </form>
      </div>
    </div>
  );
}
