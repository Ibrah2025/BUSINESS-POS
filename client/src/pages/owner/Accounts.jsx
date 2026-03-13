import { useState, useEffect, useCallback } from 'react';
import { useFinanceStore } from '../../store/financeStore';
import { useTranslation } from '../../i18n';
import api from '../../api/client';

const NIGERIAN_BANKS = [
  'GTBank', 'Access Bank', 'First Bank', 'UBA', 'Zenith Bank',
  'OPay', 'PalmPay', 'Moniepoint', 'Kuda', 'Wema Bank', 'Stanbic IBTC',
  'Sterling Bank', 'Fidelity Bank', 'Union Bank', 'Polaris Bank',
];

const ACCOUNT_TYPES = ['Bank', 'Mobile Money', 'POS Terminal'];

const ACCOUNT_TYPE_KEYS = {
  'Bank': 'bank',
  'Mobile Money': 'mobile_money',
  'POS Terminal': 'pos_terminal',
};

const TYPE_COLORS = {
  Bank: 'bg-blue-100 text-blue-800',
  'Mobile Money': 'bg-green-100 text-green-800',
  'POS Terminal': 'bg-purple-100 text-purple-800',
};

const TXN_TYPE_COLORS = {
  deposit: 'text-green-600',
  sale: 'text-green-600',
  withdrawal: 'text-red-600',
  expense: 'text-red-600',
};

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-NG', { minimumFractionDigits: 0 }).format(amount || 0);
}

function maskAccountNumber(num) {
  if (!num) return '****';
  const s = String(num);
  return '****' + s.slice(-4);
}

export default function Accounts() {
  const { bankAccounts } = useFinanceStore();
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bankSuggestions, setBankSuggestions] = useState([]);

  const [form, setForm] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    accountType: 'Bank',
    initialBalance: '',
  });

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/accounts');
      const list = data.accounts || data.data || data || [];
      setAccounts(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const fetchTransactions = async (accountId) => {
    try {
      setTxnLoading(true);
      const { data } = await api.get(`/accounts/${accountId}/transactions`);
      const list = data.transactions || data.data || data || [];
      setTransactions(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setTransactions([]);
    } finally {
      setTxnLoading(false);
    }
  };

  const handleSelectAccount = (account) => {
    if (selectedAccount?.id === account.id || selectedAccount?._id === account._id) {
      setSelectedAccount(null);
      setTransactions([]);
    } else {
      setSelectedAccount(account);
      fetchTransactions(account.id || account._id);
    }
  };

  const handleBankNameChange = (value) => {
    setForm((f) => ({ ...f, bankName: value }));
    if (value.length > 0) {
      setBankSuggestions(
        NIGERIAN_BANKS.filter((b) => b.toLowerCase().includes(value.toLowerCase()))
      );
    } else {
      setBankSuggestions([]);
    }
  };

  const handleSave = async () => {
    if (!form.bankName || !form.accountName || !form.accountNumber) return;
    try {
      setSaving(true);
      await api.post('/accounts', {
        bankName: form.bankName,
        accountName: form.accountName,
        accountNumber: form.accountNumber,
        accountType: form.accountType,
        balance: parseFloat(form.initialBalance) || 0,
      });
      setForm({ bankName: '', accountName: '', accountNumber: '', accountType: 'Bank', initialBalance: '' });
      setShowModal(false);
      setBankSuggestions([]);
      fetchAccounts();
    } catch (err) {
      console.error('Failed to save account:', err);
    } finally {
      setSaving(false);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      {/* Header */}
      <div className="bg-[var(--bg-secondary)] px-4 pt-6 pb-4 border-b border-[var(--border-color)]">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('accounts')}</h1>
        <div className="mt-3 bg-[var(--bg-primary)] rounded-xl p-4">
          <p className="text-sm text-[var(--text-secondary)]">{t('total_bank_balance')}</p>
          <p className="text-3xl font-bold text-[var(--text-primary)] mt-1">
            &#8358;{formatCurrency(totalBalance)}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="mt-3 w-full py-3 bg-blue-600 text-white font-semibold rounded-xl active:bg-blue-700 transition"
        >
          + {t('add_account')}
        </button>
      </div>

      {/* Account List */}
      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-center text-[var(--text-secondary)] py-12">
            {t('no_accounts')}
          </p>
        ) : (
          accounts.map((account) => {
            const id = account.id || account._id;
            const isSelected = (selectedAccount?.id || selectedAccount?._id) === id;
            return (
              <div key={id}>
                <button
                  onClick={() => handleSelectAccount(account)}
                  className="w-full text-left bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] active:scale-[0.98] transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] truncate">
                        {account.bankName}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)] truncate">
                        {account.accountName}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] font-mono mt-1">
                        {maskAccountNumber(account.accountNumber)}
                      </p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                          TYPE_COLORS[account.accountType] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {t(ACCOUNT_TYPE_KEYS[account.accountType] || account.accountType)}
                      </span>
                      <p className="text-lg font-bold text-[var(--text-primary)] mt-1">
                        &#8358;{formatCurrency(account.balance)}
                      </p>
                      {account.usageCount != null && (
                        <p className="text-xs text-[var(--text-secondary)]">
                          {account.usageCount} {t('txns')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end mt-1">
                    <svg
                      className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${isSelected ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Transaction History */}
                {isSelected && (
                  <div className="mt-1 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border-color)]">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {t('transaction_history')}
                      </p>
                    </div>
                    {txnLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : transactions.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)] text-center py-6">
                        {t('no_transactions')}
                      </p>
                    ) : (
                      <div className="divide-y divide-[var(--border-color)] max-h-64 overflow-y-auto">
                        {transactions.map((txn, i) => (
                          <div key={txn.id || txn._id || i} className="px-4 py-3 flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[var(--text-primary)] capitalize">
                                {t(txn.type)}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] truncate">
                                {txn.description || '—'}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)]">
                                {txn.date ? new Date(txn.date).toLocaleDateString('en-NG', {
                                  day: 'numeric', month: 'short', year: 'numeric',
                                }) : ''}
                              </p>
                            </div>
                            <p
                              className={`text-sm font-semibold ml-3 flex-shrink-0 ${
                                TXN_TYPE_COLORS[txn.type] || 'text-[var(--text-primary)]'
                              }`}
                            >
                              {txn.type === 'withdrawal' || txn.type === 'expense' ? '-' : '+'}
                              &#8358;{formatCurrency(Math.abs(txn.amount))}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Account Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { setShowModal(false); setBankSuggestions([]); }}
          />
          <div className="relative w-full max-w-lg bg-[var(--bg-secondary)] rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('add_account')}</h2>
              <button
                onClick={() => { setShowModal(false); setBankSuggestions([]); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-primary)]"
              >
                <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Bank Name */}
              <div className="relative">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t('bank_name')}
                </label>
                <input
                  type="text"
                  value={form.bankName}
                  onChange={(e) => handleBankNameChange(e.target.value)}
                  placeholder={t('bank_name_placeholder')}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {bankSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {bankSuggestions.map((bank) => (
                      <button
                        key={bank}
                        onClick={() => {
                          setForm((f) => ({ ...f, bankName: bank }));
                          setBankSuggestions([]);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-primary)] active:bg-[var(--bg-primary)]"
                      >
                        {bank}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Account Name */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t('account_name')}
                </label>
                <input
                  type="text"
                  value={form.accountName}
                  onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                  placeholder={t('account_holder_name')}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t('account_number')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.accountNumber}
                  onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))}
                  placeholder={t('account_number_placeholder')}
                  maxLength={10}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Account Type */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t('account_type')}
                </label>
                <div className="flex gap-2">
                  {ACCOUNT_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setForm((f) => ({ ...f, accountType: type }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${
                        form.accountType === type
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)]'
                      }`}
                    >
                      {t(ACCOUNT_TYPE_KEYS[type])}
                    </button>
                  ))}
                </div>
              </div>

              {/* Initial Balance */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t('initial_balance')} (&#8358;)
                </label>
                <p className="text-[10px] text-[var(--text-secondary)] leading-tight mt-0.5">{t('initial_balance_hint')}</p>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.initialBalance}
                  onChange={(e) => setForm((f) => ({ ...f, initialBalance: e.target.value.replace(/[^0-9.]/g, '') }))}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !form.bankName || !form.accountName || !form.accountNumber}
                className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50 active:bg-blue-700 transition mt-2"
              >
                {saving ? t('saving') : t('save_account')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
