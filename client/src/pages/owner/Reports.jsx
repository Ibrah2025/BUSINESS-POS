import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../i18n';
import api from '../../api/client';

function formatCurrency(amount, symbol = '\u20A6') {
  const num = Number(amount) || 0;
  return `${symbol}${num.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
}

const PERIOD_KEYS = [
  { tKey: 'today', key: 'today' },
  { tKey: 'this_week', key: 'week' },
  { tKey: 'this_month', key: 'month' },
  { tKey: 'custom_range', key: 'custom' },
];

const PAYMENT_COLORS = {
  cash: 'bg-green-500',
  bank: 'bg-blue-500',
  credit: 'bg-orange-500',
  transfer: 'bg-purple-500',
  other: 'bg-gray-400',
};

function ColorBar({ items, total }) {
  if (!total || total <= 0) return null;
  return (
    <div className="flex rounded-full overflow-hidden h-4">
      {items.map((item) => {
        const pct = Math.max((item.amount / total) * 100, 1);
        return (
          <div
            key={item.method}
            className={`${PAYMENT_COLORS[item.method] || PAYMENT_COLORS.other}`}
            style={{ width: `${pct}%` }}
            title={`${item.method}: ${Math.round(pct)}%`}
          />
        );
      })}
    </div>
  );
}

export default function Reports() {
  const { t } = useTranslation();
  const { currency } = useSettingsStore();
  const sym = currency || '\u20A6';

  const [period, setPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [error, setError] = useState('');

  const getDateRange = useCallback(() => {
    switch (period) {
      case 'today': return { from: todayStr(), to: todayStr() };
      case 'week': return getWeekRange();
      case 'month': return getMonthRange();
      case 'custom': return { from: customFrom, to: customTo };
      default: return { from: todayStr(), to: todayStr() };
    }
  }, [period, customFrom, customTo]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    const { from, to } = getDateRange();
    try {
      const { data } = await api.get(`/sales?from=${from}&to=${to}`);
      setSales(Array.isArray(data) ? data : data?.sales || []);
    } catch {
      setError(t('failed_load_report'));
      setSales([]);
    }
    setLoading(false);
  }, [getDateRange]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Computed stats
  const totalSales = sales.reduce((s, tx) => s + (Number(tx.total_amount ?? tx.total) || 0), 0);
  const txCount = sales.length;
  const avgSale = txCount > 0 ? totalSales / txCount : 0;

  const totalProfit = sales.reduce((s, tx) => s + (Number(tx.profit) || 0), 0);
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  // Top 5 products
  const productMap = {};
  sales.forEach((tx) => {
    (tx.items || []).forEach((item) => {
      const name = item.name || item.product || t('unknown');
      if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
      productMap[name].qty += Number(item.quantity) || 1;
      productMap[name].revenue += Number(item.subtotal) || (Number(item.unit_price || item.price || 0) * (Number(item.quantity) || 1));
    });
  });
  const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const maxProductQty = topProducts[0]?.qty || 1;

  // Payment breakdown
  const paymentMap = {};
  sales.forEach((tx) => {
    (tx.payments || []).forEach((p) => {
      const method = (p.method || 'cash').toLowerCase();
      if (!paymentMap[method]) paymentMap[method] = { method, amount: 0, count: 0 };
      paymentMap[method].amount += parseFloat(p.amount) || 0;
      paymentMap[method].count += 1;
    });
    if (!tx.payments || tx.payments.length === 0) {
      const method = 'cash';
      if (!paymentMap[method]) paymentMap[method] = { method, amount: 0, count: 0 };
      paymentMap[method].amount += parseFloat(tx.total_amount) || 0;
      paymentMap[method].count += 1;
    }
  });
  const paymentBreakdown = Object.values(paymentMap).sort((a, b) => b.amount - a.amount);

  // Staff performance
  const staffMap = {};
  sales.forEach((tx) => {
    const name = tx.attendant || tx.staff || t('unknown');
    if (!staffMap[name]) staffMap[name] = { name, sales: 0, amount: 0 };
    staffMap[name].sales += 1;
    staffMap[name].amount += parseFloat(tx.total_amount) || 0;
  });
  const staffPerf = Object.values(staffMap).sort((a, b) => b.amount - a.amount);
  const maxStaffAmt = staffPerf[0]?.amount || 1;

  const [exporting, setExporting] = useState('');

  const handleExport = async (type) => {
    const { from, to } = getDateRange();
    setExporting(type);
    try {
      const response = await api.get(`/export/${type}?startDate=${from}&endDate=${to}`, { responseType: 'blob' });
      const blob = response.data;

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });

        const ext = type === 'excel' ? 'xlsx' : 'html';
        const fileName = `bizpos-report-${from}-to-${to}.${ext}`;

        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: fileName,
          url: result.uri,
          dialogTitle: t('export_report') || 'Export Report',
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${from}-to-${to}.${type === 'excel' ? 'xlsx' : 'html'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      setError(t('export_failed') || 'Export failed');
    }
    setExporting('');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-6">
      <header className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('reports')}</h1>
      </header>

      <main className="px-4 py-4 max-w-3xl mx-auto space-y-4">
        {/* Period selector */}
        <div className="flex flex-wrap gap-2">
          {PERIOD_KEYS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                period === p.key
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
            >
              {t(p.tKey)}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-1.5 text-sm outline-none"
            />
            <span className="text-sm text-[var(--text-secondary)]">{t('to')}</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-1.5 text-sm outline-none"
            />
          </div>
        )}

        {/* Export buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('excel')}
            disabled={!!exporting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {exporting === 'excel' ? '...' : t('export_excel')}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={!!exporting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {exporting === 'pdf' ? '...' : t('export_pdf')}
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-12 text-center text-sm text-[var(--text-secondary)]">{t('loading')}</div>
        ) : error ? (
          <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center text-sm text-[var(--danger)]">{error}</div>
        ) : (
          <>
            {/* Sales Summary */}
            <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">{t('sales_summary')}</h2>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">{t('total_sales')}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{t('total_sales_hint')}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{formatCurrency(totalSales, sym)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">{t('transactions')}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{txCount}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">{t('avg_sale')}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{t('avg_sale_hint')}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{formatCurrency(avgSale, sym)}</p>
                </div>
              </div>
            </div>

            {/* Profit Summary */}
            <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">{t('profit_summary')}</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">{t('total_profit')}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{t('total_profit_hint')}</p>
                  <p className={`text-lg font-bold mt-1 ${totalProfit >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {formatCurrency(totalProfit, sym)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">{t('profit_margin')}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{t('profit_margin_hint')}</p>
                  <p className={`text-lg font-bold mt-1 ${profitMargin >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {profitMargin.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Top 5 Products */}
            <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">{t('top_products')}</h2>
              {topProducts.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">{t('no_product_data')}</p>
              ) : (
                <div className="space-y-2.5">
                  {topProducts.map((p, i) => (
                    <div key={p.name}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="text-[var(--text-primary)] truncate">{i + 1}. {p.name}</span>
                        <span className="text-[var(--text-secondary)] shrink-0 ml-2">{p.qty} {t('sold')} — {formatCurrency(p.revenue, sym)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${(p.qty / maxProductQty) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Method Breakdown */}
            <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">{t('payment_methods')}</h2>
              {paymentBreakdown.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">{t('no_data')}</p>
              ) : (
                <>
                  <ColorBar items={paymentBreakdown} total={totalSales} />
                  <div className="mt-3 space-y-1.5">
                    {paymentBreakdown.map((p) => (
                      <div key={p.method} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-sm ${PAYMENT_COLORS[p.method] || PAYMENT_COLORS.other}`} />
                        <span className="text-sm text-[var(--text-primary)] capitalize flex-1">{p.method}</span>
                        <span className="text-sm text-[var(--text-secondary)]">{p.count} {t('tx')}</span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(p.amount, sym)}</span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          ({totalSales > 0 ? ((p.amount / totalSales) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Staff Performance */}
            {staffPerf.length > 1 && (
              <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4">
                <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">{t('staff_performance')}</h2>
                <div className="space-y-2.5">
                  {staffPerf.map((s) => (
                    <div key={s.name}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="text-[var(--text-primary)]">{s.name}</span>
                        <span className="text-[var(--text-secondary)]">{s.sales} {t('sales')} — {formatCurrency(s.amount, sym)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${(s.amount / maxStaffAmt) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
