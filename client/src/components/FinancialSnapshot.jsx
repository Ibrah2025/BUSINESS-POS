import React from 'react';
import { useTranslation } from '../i18n';

function formatAmount(val) {
  const n = Number(val) || 0;
  return n.toLocaleString();
}

export default function FinancialSnapshot({ data = {}, onMetricClick }) {
  const { t } = useTranslation();

  const METRICS = [
    { key: 'physicalCash', label: t('physical_cash'), icon: '💵', positive: true },
    { key: 'bankBalance', label: t('bank_balance'), icon: '🏦', positive: true },
    { key: 'customerCredits', label: t('customer_debts'), icon: '📋', positive: false },
    { key: 'supplierCredits', label: t('supplier_debts'), icon: '🚚', positive: false },
    { key: 'expenses', label: t('monthly_expenses'), icon: '📊', positive: false },
    { key: 'profit', label: t('realized_profit'), icon: '📈', positive: true },
    { key: 'netPosition', label: t('net_position'), icon: '🎯', positive: null },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('financial_snapshot')}</h3>
      <div className="grid grid-cols-2 gap-2">
        {METRICS.map(m => {
          const val = Number(data[m.key]) || 0;
          const isPositive = m.positive === null ? val >= 0 : m.positive;
          const colorClass = m.positive === false || (m.positive === null && val < 0)
            ? 'text-red-600'
            : 'text-green-600';

          return (
            <button
              key={m.key}
              onClick={() => onMetricClick?.(m.key)}
              className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <span className="text-lg">{m.icon}</span>
              <div className="min-w-0">
                <div className="text-[11px] text-gray-400 leading-tight">{m.label}</div>
                <div className={`text-sm font-bold ${colorClass}`}>
                  {val < 0 ? '-' : ''}{formatAmount(Math.abs(val))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
