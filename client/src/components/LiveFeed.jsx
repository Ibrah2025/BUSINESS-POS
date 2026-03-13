import React, { useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';

const methodColors = {
  cash: 'bg-green-500',
  bank: 'bg-blue-500',
  pos: 'bg-blue-500',
  mobile: 'bg-blue-500',
  credit: 'bg-red-500',
  split: 'bg-yellow-500',
};

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function LiveFeed({ transactions = [] }) {
  const { t } = useTranslation();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transactions.length]);

  if (transactions.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-8">{t('no_transactions_yet')}</div>
    );
  }

  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {transactions.map((tx, i) => (
        <div key={tx.id || i} className="flex items-center gap-3 py-2 px-3 hover:bg-gray-50 rounded-lg">
          {/* Colored dot */}
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${methodColors[tx.paymentMethod] || 'bg-gray-400'}`} />

          {/* Time */}
          <span className="text-xs text-gray-400 w-12 shrink-0">{formatTime(tx.createdAt)}</span>

          {/* Items summary */}
          <span className="text-sm text-gray-700 flex-1 truncate">
            {tx.itemsSummary || `${tx.itemCount || 0} ${t('items')}`}
          </span>

          {/* Amount */}
          <span className="text-sm font-semibold text-gray-900 shrink-0">
            {Number(tx.total).toLocaleString()}
          </span>

          {/* Attendant */}
          <span className="text-xs text-gray-400 w-16 text-right truncate shrink-0">
            {tx.attendantName}
          </span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
