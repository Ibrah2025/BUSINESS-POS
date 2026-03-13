import { useState, useEffect, useMemo } from 'react';
import { useFinanceStore } from '../../store/financeStore';
import { useTranslation } from '../../i18n';
import api from '../../api/client';

const CATEGORIES = ['Rent', 'Salary', 'Transport', 'Stock', 'Utilities', 'Maintenance', 'Other'];

const CATEGORY_KEYS = {
  Rent: 'cat_rent', Salary: 'cat_salary', Transport: 'cat_transport', Stock: 'cat_stock',
  Utilities: 'cat_utilities', Maintenance: 'cat_maintenance', Other: 'cat_other',
};

const CATEGORY_ICONS = {
  Rent: '🏠', Salary: '👤', Transport: '🚗', Stock: '📦',
  Utilities: '💡', Maintenance: '🔧', Other: '📋',
};

const CATEGORY_COLORS = {
  Rent: 'bg-purple-100 text-purple-800',
  Salary: 'bg-blue-100 text-blue-800',
  Transport: 'bg-orange-100 text-orange-800',
  Stock: 'bg-emerald-100 text-emerald-800',
  Utilities: 'bg-yellow-100 text-yellow-800',
  Maintenance: 'bg-pink-100 text-pink-800',
  Other: 'bg-gray-100 text-gray-800',
};

function formatCurrency(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG');
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(date) {
  return date.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
}

export default function Expenses() {
  const { expenses, addExpense, setFinancialData } = useFinanceStore();
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [groupBy, setGroupBy] = useState('date'); // 'date' | 'category'
  const [showModal, setShowModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [swipedId, setSwipedId] = useState(null);

  const monthKey = getMonthKey(currentMonth);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/expenses?month=${monthKey}`);
        setFinancialData({ expenses: Array.isArray(data) ? data : data.expenses ?? [] });
      } catch (err) {
        console.error('Failed to fetch expenses:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [monthKey, setFinancialData]);

  const filtered = useMemo(
    () =>
      expenses.filter((e) => {
        const d = new Date(e.date || e.createdAt);
        return getMonthKey(d) === monthKey;
      }),
    [expenses, monthKey]
  );

  const categoryTotals = useMemo(() => {
    const map = {};
    CATEGORIES.forEach((c) => (map[c] = 0));
    filtered.forEach((e) => {
      const cat = CATEGORIES.includes(e.category) ? e.category : 'Other';
      map[cat] += Number(e.amount) || 0;
    });
    return map;
  }, [filtered]);

  const monthTotal = useMemo(() => filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0), [filtered]);

  const grouped = useMemo(() => {
    if (groupBy === 'category') {
      const map = {};
      filtered.forEach((e) => {
        const cat = CATEGORIES.includes(e.category) ? e.category : 'Other';
        (map[cat] = map[cat] || []).push(e);
      });
      return Object.entries(map).sort(([a], [b]) => CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b));
    }
    // chronological — group by date
    const sorted = [...filtered].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    const map = {};
    sorted.forEach((e) => {
      const key = formatDate(e.date || e.createdAt);
      (map[key] = map[key] || []).push(e);
    });
    return Object.entries(map);
  }, [filtered, groupBy]);

  function shiftMonth(delta) {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  }

  async function handleDelete(id) {
    if (!confirm(t('delete_expense_confirm'))) return;
    try {
      await api.delete(`/expenses/${id}`);
      setFinancialData({ expenses: expenses.filter((e) => e.id !== id) });
      setSwipedId(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)] border-b border-[var(--border)]">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('expenses')}</h1>
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-between px-4 pb-3">
          <button onClick={() => shiftMonth(-1)} className="p-2 text-[var(--text-secondary)] text-lg">&lt;</button>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{getMonthLabel(currentMonth)}</span>
          <button onClick={() => shiftMonth(1)} className="p-2 text-[var(--text-secondary)] text-lg">&gt;</button>
        </div>

        {/* Category summary cards */}
        <div className="px-4 pb-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {CATEGORIES.map((cat) => (
              <div key={cat} className={`rounded-lg px-3 py-2 min-w-[80px] text-center ${CATEGORY_COLORS[cat]}`}>
                <p className="text-[10px] font-medium">{t(CATEGORY_KEYS[cat])}</p>
                <p className="text-xs font-bold">{formatCurrency(categoryTotals[cat])}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Total + grouping toggle */}
        <div className="flex items-center justify-between px-4 pb-3">
          <p className="text-sm font-bold text-[var(--text-primary)]">{t('total')}: {formatCurrency(monthTotal)}</p>
          <div className="flex bg-[var(--bg-secondary)] rounded-lg overflow-hidden text-xs">
            {['date', 'category'].map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1 ${groupBy === g ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                {g === 'date' ? t('date') : t('category')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Add Expense Button */}
      <div className="px-4 pt-3">
        <button
          onClick={() => { setEditExpense(null); setShowModal(true); }}
          className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-semibold text-sm"
        >
          + {t('add_expense')}
        </button>
      </div>

      {/* Expense list */}
      <div className="px-4 pt-3 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-7 h-7 border-4 border-[var(--accent)] border-t-transparent rounded-full" />
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-center text-[var(--text-secondary)] py-12 text-sm">{t('no_expenses')}</p>
        ) : (
          grouped.map(([label, items]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">{label}</p>
              <div className="space-y-2">
                {items.map((expense) => {
                  const cat = CATEGORIES.includes(expense.category) ? expense.category : 'Other';
                  const swiped = swipedId === expense.id;

                  return (
                    <div key={expense.id} className="relative overflow-hidden rounded-xl">
                      {/* Delete background */}
                      {swiped && (
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center text-white text-xs font-semibold z-0"
                        >
                          {t('delete')}
                        </button>
                      )}

                      <div
                        className={`relative z-10 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-3 transition-transform ${
                          swiped ? '-translate-x-20' : ''
                        }`}
                        onClick={() => { setEditExpense(expense); setShowModal(true); }}
                        onTouchStart={(e) => {
                          const startX = e.touches[0].clientX;
                          const el = e.currentTarget;
                          function onMove(ev) {
                            const diff = startX - ev.touches[0].clientX;
                            if (diff > 60) setSwipedId(expense.id);
                            else if (diff < -20) setSwipedId(null);
                          }
                          function onEnd() {
                            el.removeEventListener('touchmove', onMove);
                            el.removeEventListener('touchend', onEnd);
                          }
                          el.addEventListener('touchmove', onMove);
                          el.addEventListener('touchend', onEnd);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat]}`}>
                              {t(CATEGORY_KEYS[cat])}
                            </span>
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              {expense.description || t(CATEGORY_KEYS[cat])}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">{formatCurrency(expense.amount)}</p>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[10px] text-[var(--text-secondary)]">
                            {formatDate(expense.date || expense.createdAt)}
                          </p>
                          <p className="text-[10px] text-[var(--text-secondary)]">
                            {expense.method === 'bank' ? t('bank') : t('cash')}
                            {expense.isRecurring && ` • ${t('recurring')}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <ExpenseModal
          expense={editExpense}
          onClose={() => { setShowModal(false); setEditExpense(null); }}
          onSuccess={(saved) => {
            if (editExpense) {
              setFinancialData({
                expenses: expenses.map((e) => (e.id === saved.id ? saved : e)),
              });
            } else {
              addExpense(saved);
            }
            setShowModal(false);
            setEditExpense(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Expense Modal ─── */
function ExpenseModal({ expense, onClose, onSuccess }) {
  const { bankAccounts } = useFinanceStore();
  const { t } = useTranslation();
  const [category, setCategory] = useState(expense?.category || 'Other');
  const [description, setDescription] = useState(expense?.description || '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [date, setDate] = useState(
    expense?.date ? new Date(expense.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [method, setMethod] = useState(expense?.method || 'cash');
  const [bankId, setBankId] = useState(expense?.bankAccountId || bankAccounts[0]?.id || '');
  const [isRecurring, setIsRecurring] = useState(expense?.isRecurring || false);
  const [interval, setInterval] = useState(expense?.interval || 'monthly');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!expense;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount) return;
    setSubmitting(true);
    try {
      const payload = {
        category,
        description,
        amount: Number(amount),
        date,
        method,
        ...(method === 'bank' && { bankAccountId: bankId }),
        isRecurring,
        ...(isRecurring && { interval }),
      };

      const { data } = isEdit
        ? await api.put(`/expenses/${expense.id}`, payload)
        : await api.post('/expenses', payload);
      onSuccess(data);
    } catch (err) {
      console.error('Save failed:', err);
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
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {isEdit ? t('edit_expense') : t('add_expense')}
          </h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">{t('category')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(CATEGORY_KEYS[c])}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">{t('description')}</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
            <label className="text-xs font-medium text-[var(--text-secondary)]">{t('date')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">{t('payment_method')}</label>
            <div className="flex gap-3 mt-1">
              {['cash', 'bank'].map((m) => (
                <label key={m} className="flex items-center gap-1.5 text-sm text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="radio"
                    name="expMethod"
                    value={m}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="accent-[var(--accent)]"
                  />
                  {m === 'cash' ? t('cash') : t('bank')}
                </label>
              ))}
            </div>
          </div>

          {method === 'bank' && bankAccounts.length > 0 && (
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

          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)]">{t('is_recurring')}</label>
              <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{t('is_recurring_hint')}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                isRecurring ? 'bg-[var(--accent)]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  isRecurring ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {isRecurring && (
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)]">{t('recurring_interval')}</label>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
              >
                <option value="weekly">{t('weekly')}</option>
                <option value="monthly">{t('monthly')}</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? t('saving') : isEdit ? t('edit_expense') : t('add_expense')}
          </button>
        </form>
      </div>
    </div>
  );
}
