import { useState, useEffect, useCallback } from 'react';
import { useFinanceStore } from '../../store/financeStore';
import { useTranslation } from '../../i18n';
import api from '../../api/client';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-NG', { minimumFractionDigits: 0 }).format(amount || 0);
}

export default function CashRegister() {
  const { physicalCash, updateCash } = useFinanceStore();
  const { t } = useTranslation();
  const [cashBalance, setCashBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState(null); // 'add' | 'remove' | null
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reconciliation
  const [showReconcile, setShowReconcile] = useState(false);
  const [countedAmount, setCountedAmount] = useState('');
  const [reconcileResult, setReconcileResult] = useState(null);

  const fetchCashData = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/cash');
      setCashBalance(data.balance ?? data.physicalCash ?? data.cash ?? 0);
      const txns = data.transactions || data.cashTransactions || data.data || [];
      setTransactions(Array.isArray(txns) ? txns : []);
    } catch (err) {
      console.error('Failed to fetch cash data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCashData();
  }, [fetchCashData]);

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    try {
      setSubmitting(true);
      const endpoint = activeAction === 'add' ? '/cash/add' : '/cash/remove';
      await api.post(endpoint, {
        amount: parsedAmount,
        description: description.trim() || undefined,
      });
      updateCash(activeAction === 'add' ? parsedAmount : -parsedAmount);
      setAmount('');
      setDescription('');
      setActiveAction(null);
      fetchCashData();
    } catch (err) {
      console.error('Cash operation failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReconcile = () => {
    const counted = parseFloat(countedAmount);
    if (isNaN(counted)) return;
    const expected = cashBalance;
    const difference = counted - expected;
    setReconcileResult({ expected, counted, difference });
  };

  const getTxnSign = (type) => {
    const addTypes = ['add', 'sale', 'deposit', 'refund_in'];
    return addTypes.includes(type) ? '+' : '-';
  };

  const getTxnColor = (type) => {
    const addTypes = ['add', 'sale', 'deposit', 'refund_in'];
    return addTypes.includes(type) ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      {/* Header with cash display */}
      <div className="bg-[var(--bg-secondary)] px-4 pt-6 pb-5 border-b border-[var(--border-color)]">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('cash_register')}</h1>
        <div className="mt-4 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 text-center">
          <p className="text-green-100 text-sm font-medium">{t('physical_cash')}</p>
          {loading ? (
            <div className="flex justify-center py-3">
              <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <p className="text-4xl font-bold text-white mt-1">
              &#8358;{formatCurrency(cashBalance)}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setActiveAction(activeAction === 'add' ? null : 'add')}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition ${
              activeAction === 'add'
                ? 'bg-green-600 text-white'
                : 'bg-[var(--bg-primary)] text-green-600 border border-green-600'
            }`}
          >
            + {t('add_cash')}
          </button>
          <button
            onClick={() => setActiveAction(activeAction === 'remove' ? null : 'remove')}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition ${
              activeAction === 'remove'
                ? 'bg-red-600 text-white'
                : 'bg-[var(--bg-primary)] text-red-600 border border-red-600'
            }`}
          >
            - {t('remove_cash')}
          </button>
        </div>

        {/* Expandable Form */}
        {activeAction && (
          <div className="mt-4 bg-[var(--bg-primary)] rounded-xl p-4 border border-[var(--border-color)] space-y-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {activeAction === 'add' ? t('add_cash') : t('remove_cash')}
            </p>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('amount')} (&#8358;)</label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('description')}</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  activeAction === 'add'
                    ? t('cash_add_placeholder')
                    : t('cash_remove_placeholder')
                }
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || !amount || parseFloat(amount) <= 0}
              className={`w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 transition ${
                activeAction === 'add' ? 'bg-green-600 active:bg-green-700' : 'bg-red-600 active:bg-red-700'
              }`}
            >
              {submitting
                ? t('processing')
                : activeAction === 'add'
                ? t('confirm_add')
                : t('confirm_remove')}
            </button>
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{t('transaction_history')}</h2>
          <button
            onClick={() => {
              setShowReconcile(!showReconcile);
              setReconcileResult(null);
              setCountedAmount('');
            }}
            className="text-sm font-medium text-blue-600 active:text-blue-800"
          >
            {showReconcile ? t('close') : t('count_cash')}
          </button>
        </div>

        {/* Reconciliation */}
        {showReconcile && (
          <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] mb-4 space-y-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t('cash_reconciliation')}</p>
            <p className="text-[11px] text-[var(--text-secondary)] leading-tight">{t('cash_reconciliation_hint')}</p>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                {t('actual_count')} (&#8358;)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={countedAmount}
                onChange={(e) => setCountedAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={t('enter_counted')}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
              />
            </div>
            <button
              onClick={handleReconcile}
              disabled={!countedAmount}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50 active:bg-blue-700 transition"
            >
              {t('compare')}
            </button>

            {reconcileResult && (
              <div className="bg-[var(--bg-primary)] rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-start text-sm">
                  <div>
                    <span className="text-[var(--text-secondary)] font-medium">{t('expected')}</span>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{t('expected_hint')}</p>
                  </div>
                  <span className="text-[var(--text-primary)] font-semibold">
                    &#8358;{formatCurrency(reconcileResult.expected)}
                  </span>
                </div>
                <div className="flex justify-between items-start text-sm">
                  <div>
                    <span className="text-[var(--text-secondary)] font-medium">{t('counted')}</span>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{t('counted_hint')}</p>
                  </div>
                  <span className="text-[var(--text-primary)] font-semibold">
                    &#8358;{formatCurrency(reconcileResult.counted)}
                  </span>
                </div>
                <div className="border-t border-[var(--border-color)] pt-2 flex justify-between items-start text-sm">
                  <div>
                    <span className="text-[var(--text-secondary)] font-medium">{t('difference')}</span>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{t('difference_hint')}</p>
                  </div>
                  <span
                    className={`font-bold ${
                      reconcileResult.difference === 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {reconcileResult.difference === 0
                      ? t('balanced')
                      : `${reconcileResult.difference > 0 ? '+' : ''}₦${formatCurrency(
                          Math.abs(reconcileResult.difference)
                        )}`}
                  </span>
                </div>
                {reconcileResult.difference === 0 && (
                  <p className="text-xs text-green-600 text-center font-medium mt-1">
                    {t('cash_balanced')}
                  </p>
                )}
                {reconcileResult.difference !== 0 && (
                  <p className="text-xs text-red-600 text-center font-medium mt-1">
                    {t('discrepancy')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Transaction List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-[var(--text-secondary)] py-12">
            {t('no_cash_transactions')}
          </p>
        ) : (
          <div className="space-y-2">
            {transactions.map((txn, i) => (
              <div
                key={txn.id || txn._id || i}
                className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                        getTxnSign(txn.type) === '+' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <p className="text-sm font-medium text-[var(--text-primary)] capitalize">
                      {t(txn.type)}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5 ml-4">
                    {txn.description || '—'}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] ml-4">
                    {txn.date || txn.createdAt
                      ? new Date(txn.date || txn.createdAt).toLocaleString('en-NG', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </p>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <p className={`text-sm font-bold ${getTxnColor(txn.type)}`}>
                    {getTxnSign(txn.type)}&#8358;{formatCurrency(Math.abs(txn.amount))}
                  </p>
                  {txn.balanceAfter != null && (
                    <p className="text-xs text-[var(--text-secondary)]">
                      {t('balance')}: &#8358;{formatCurrency(txn.balanceAfter)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
