import React, { useState } from 'react';
import { useTranslation } from '../i18n';

const BANK_METHODS = ['bank', 'pos', 'mobile'];

export default function PaymentSelector({
  selected,
  onSelect,
  onConfigChange,
  bankAccounts = [],
  totalAmount = 0,
}) {
  const { t } = useTranslation();
  const [selectedBank, setSelectedBank] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [split, setSplit] = useState({ cash: '', bank: '', credit: '' });

  const handleSelect = (key) => {
    onSelect(key);
    // Reset sub-configs
    if (key !== 'credit') setCustomerName('');
    if (!BANK_METHODS.includes(key)) setSelectedBank('');
    if (key !== 'split') setSplit({ cash: '', bank: '', credit: '' });
  };

  const handleBankChange = (accountId) => {
    setSelectedBank(accountId);
    onConfigChange?.({ method: selected, bankAccountId: accountId });
  };

  const handleCustomerChange = (name) => {
    setCustomerName(name);
    onConfigChange?.({ method: 'credit', customerName: name });
  };

  const handleSplitChange = (field, value) => {
    const next = { ...split, [field]: value };
    setSplit(next);
    const numVal = (v) => parseFloat(v) || 0;
    onConfigChange?.({
      method: 'split',
      cash: numVal(next.cash),
      bank: numVal(next.bank),
      credit: numVal(next.credit),
    });
  };

  const splitRemaining = totalAmount - (parseFloat(split.cash) || 0) - (parseFloat(split.bank) || 0) - (parseFloat(split.credit) || 0);

  const METHODS = [
    { key: 'cash', label: t('cash'), icon: '💵' },
    { key: 'bank', label: t('bank_transfer'), icon: '🏦' },
    { key: 'pos', label: t('pos'), icon: '💳' },
    { key: 'mobile', label: t('mobile_money'), icon: '📱' },
    { key: 'credit', label: t('credit'), icon: '📝' },
    { key: 'split', label: t('split'), icon: '✂️' },
  ];

  // Sort bank accounts by usage frequency (assume usageCount property)
  const sortedBanks = [...bankAccounts].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));

  return (
    <div className="space-y-3">
      {/* Method buttons */}
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map(m => (
          <button
            key={m.key}
            onClick={() => handleSelect(m.key)}
            className={`
              flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors
              ${selected === m.key
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}
            `}
          >
            <span className="text-lg">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* Bank account selector */}
      {BANK_METHODS.includes(selected) && (
        <select
          value={selectedBank}
          onChange={e => handleBankChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
        >
          <option value="">{t('select_bank_account')}</option>
          {sortedBanks.map(b => (
            <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
          ))}
        </select>
      )}

      {/* Credit: customer name */}
      {selected === 'credit' && (
        <input
          type="text"
          value={customerName}
          onChange={e => handleCustomerChange(e.target.value)}
          placeholder={t('customer_name')}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
        />
      )}

      {/* Split payment */}
      {selected === 'split' && (
        <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
          {[
            { key: 'cash', label: t('cash') },
            { key: 'bank', label: t('bank_pos') },
            { key: 'credit', label: t('credit') },
          ].map(f => (
            <div key={f.key} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16">{f.label}</span>
              <input
                type="number"
                value={split[f.key]}
                onChange={e => handleSplitChange(f.key, e.target.value)}
                placeholder="0"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-green-500"
              />
            </div>
          ))}
          <div className={`text-right text-sm font-medium ${splitRemaining === 0 ? 'text-green-600' : splitRemaining > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
            {t('remaining')} {splitRemaining.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
