import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useFinanceStore } from '../../store/financeStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useOffline } from '../../hooks/useOffline';
import api from '../../api/client';
import { useTranslation } from '../../i18n';

function formatCurrency(amount, symbol = '\u20A6') {
  const num = Number(amount) || 0;
  return `${symbol}${num.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

function SkeletonLine({ width = 'w-24', height = 'h-4' }) {
  return (
    <div
      className={`${width} ${height} rounded bg-[var(--border-color)] animate-pulse`}
    />
  );
}

function SkeletonCard({ lines = 3 }) {
  return (
    <div className="rounded-xl p-4 bg-[var(--card-bg)] border border-[var(--border-color)]">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex justify-between items-center mb-3 last:mb-0">
          <SkeletonLine width="w-20" />
          <SkeletonLine width="w-28" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { businessName, currency, dataSaverMode } = useSettingsStore();
  const { t } = useTranslation();
  const { isOffline, showBanner, dismissBanner } = useOffline();
  const financeStore = useFinanceStore();
  const { liveFeed, addTransaction } = useNotificationStore();

  const [todaySummary, setTodaySummary] = useState(null);
  const [yesterdaySales, setYesterdaySales] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [finLoading, setFinLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const refreshTimer = useRef(null);

  const fetchTodaySummary = useCallback(async () => {
    try {
      const { data } = await api.get('/sales/today');
      setTodaySummary(data);
    } catch {
      // keep cached data on failure
    }
    try {
      const { data: yData } = await api.get('/sales/yesterday');
      setYesterdaySales(yData?.totalSales ?? null);
    } catch {
      // ignore
    }
  }, []);

  const fetchFinancials = useCallback(async () => {
    try {
      const [snapshotRes, accountsRes, creditsRes, expensesRes] = await Promise.allSettled([
        api.get('/cash/snapshot'),
        api.get('/accounts'),
        api.get('/credits'),
        api.get('/expenses'),
      ]);

      const snap = snapshotRes.status === 'fulfilled' ? snapshotRes.value.data : {};
      const accounts = accountsRes.status === 'fulfilled' ? accountsRes.value.data : {};
      const credits = creditsRes.status === 'fulfilled' ? creditsRes.value.data : {};
      const expenses = expensesRes.status === 'fulfilled' ? expensesRes.value.data : {};

      const fin = {
        physicalCash: snap.physicalCash ?? 0,
        bankBalance: snap.bankBalance ?? 0,
        customerDebts: snap.customerCredits ?? 0,
        supplierDebts: snap.supplierCredits ?? 0,
        monthlyExpenses: snap.totalExpenses ?? 0,
        realizedProfit: snap.realizedProfit ?? 0,
        inventoryValue: snap.inventoryValue ?? 0,
        netPosition: snap.netPosition ?? 0,
      };

      setFinancials(fin);
      financeStore.setFinancialData({
        physicalCash: fin.physicalCash,
        bankAccounts: accounts.accounts ?? [],
        customerCredits: credits.customerCredits ?? [],
        supplierCredits: credits.supplierCredits ?? [],
        expenses: expenses.expenses ?? [],
      });
    } catch {
      // keep cached on failure
    }
  }, [financeStore]);

  // Load today's recent sales into liveFeed on mount
  const fetchRecentSales = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await api.get('/sales', { params: { startDate: today, limit: 20 } });
      const sales = data.sales || data.data || [];
      if (sales.length > 0 && liveFeed.length === 0) {
        // Reverse so newest ends up on top (addTransaction prepends)
        [...sales].reverse().forEach((s) => {
          addTransaction({
            id: s.id,
            total: Number(s.total_amount || s.totalAmount || 0),
            items: (s.items || []).map((it) => ({ name: it.name || it.product_name, quantity: it.quantity })),
            paymentMethod: s.payments?.[0]?.method || 'cash',
            attendant: s.attendant_name || s.attendantName,
            timestamp: s.created_at || s.createdAt,
          });
        });
      }
    } catch {
      // ignore — live feed is optional
    }
  }, [addTransaction, liveFeed.length]);

  // Initial data load
  useEffect(() => {
    async function load() {
      setLoading(true);
      setFinLoading(true);
      await fetchTodaySummary();
      setLoading(false);
      await fetchRecentSales();
      await fetchFinancials();
      setFinLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 60s
  useEffect(() => {
    refreshTimer.current = setInterval(() => {
      fetchTodaySummary();
    }, 60000);
    return () => clearInterval(refreshTimer.current);
  }, [fetchTodaySummary]);

  // Load streak from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('bizpos_streak') || '{}');
      if (stored.count && stored.count >= 2) setStreak(stored.count);
    } catch { /* ignore */ }
  }, []);

  // WebSocket for live sales
  const handleWsEvent = useCallback(
    (eventName, payload) => {
      if (eventName === 'new-sale') {
        // payload is { type, businessId, data: saleData, timestamp }
        const sale = payload.data || payload;
        addTransaction({
          id: sale.id,
          total: Number(sale.total_amount || sale.totalAmount || sale.total || 0),
          items: (sale.items || []).map((it) => ({
            name: it.name || it.product_name || it.productName,
            quantity: it.quantity,
          })),
          paymentMethod: sale.payments?.[0]?.method || 'cash',
          attendant: sale.attendant_name || sale.attendantName,
          timestamp: payload.timestamp || sale.created_at || Date.now(),
        });
        fetchTodaySummary();
      }
    },
    [addTransaction, fetchTodaySummary]
  );

  useWebSocket({
    businessId: user?.businessId,
    dataSaverMode,
    onEvent: handleWsEvent,
  });

  const sym = currency || '\u20A6';

  const summaryItems = todaySummary
    ? [
        { label: t('sales'), value: formatCurrency(todaySummary.totalSales, sym), sub: `${todaySummary.transactionCount ?? 0} ${t('tx')}` },
        { label: t('profit'), value: formatCurrency(todaySummary.totalProfit, sym) },
        { label: t('cash'), value: formatCurrency(todaySummary.cashTotal, sym) },
        { label: t('bank'), value: formatCurrency(todaySummary.bankTotal, sym) },
      ]
    : [];

  const financeItems = financials
    ? [
        { label: t('physical_cash'), hint: t('physical_cash_hint'), value: financials.physicalCash, color: 'text-[var(--success)]', link: '/cash' },
        { label: t('bank_balance'), hint: t('bank_balance_hint'), value: financials.bankBalance, color: 'text-[var(--success)]', link: '/accounts' },
        { label: t('customer_debts'), hint: t('customer_debts_hint'), value: financials.customerDebts, color: 'text-[var(--success)]', link: '/credits' },
        { label: t('supplier_debts'), hint: t('supplier_debts_hint'), value: financials.supplierDebts, color: 'text-[var(--danger)]', link: '/credits' },
        { label: t('inventory_value'), hint: t('inventory_value_hint'), value: financials.inventoryValue, color: 'text-[var(--success)]', link: '/inventory' },
        { label: t('monthly_expenses'), hint: t('monthly_expenses_hint'), value: financials.monthlyExpenses, color: 'text-[var(--danger)]', link: '/expenses' },
        { label: t('realized_profit'), hint: t('realized_profit_hint'), value: financials.realizedProfit, color: 'text-[var(--success)]', link: '/reports' },
      ]
    : [];

  const bottomNav = [
    { label: t('sell'), icon: '🛒', path: '/scan' },
    { label: t('inventory'), icon: '📦', path: '/inventory' },
    { label: t('reports'), icon: '📈', path: '/reports' },
    { label: t('credits'), icon: '💰', path: '/credits' },
    { label: t('staff'), icon: '👥', path: '/staff' },
  ];

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-primary)] pb-4">
      {/* Offline banner */}
      {showBanner && (
        <div
          className={`px-4 py-2 text-center text-sm font-medium ${
            isOffline
              ? 'bg-[var(--danger)] text-white'
              : 'bg-[var(--success)] text-white'
          }`}
        >
          {isOffline ? t('offline_cached_data') : t('online')}
          <button onClick={dismissBanner} className="ml-3 underline text-xs">
            {t('dismiss')}
          </button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            📊 {t('dashboard')}
          </h1>
          {businessName && (
            <p className="text-sm text-[var(--text-secondary)]">{businessName}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {streak >= 2 && (
            <span className="text-sm font-semibold text-[var(--text-secondary)]">
              🔥 {streak}
            </span>
          )}
          <button
            onClick={() => navigate('/settings')}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-primary)] text-lg"
            aria-label={t('settings')}
          >
            ⚙
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
        {/* Today's Summary */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
            {t('todays_summary')}
          </h2>
          {yesterdaySales !== null && todaySummary && (
            <p className="text-xs text-[var(--text-secondary)] mb-1">
              {t('yesterday')}: {formatCurrency(yesterdaySales, sym)} · {t('today')}: {formatCurrency(todaySummary.totalSales, sym)}{' '}
              <span className={todaySummary.totalSales >= yesterdaySales ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                {todaySummary.totalSales >= yesterdaySales ? '↑' : '↓'}
              </span>
            </p>
          )}
          {loading ? (
            <SkeletonCard lines={4} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl p-3 bg-[var(--card-bg)] border border-[var(--border-color)]"
                >
                  <p className="text-xs text-[var(--text-secondary)] mb-1">
                    {item.label}
                  </p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {item.value}
                  </p>
                  {item.sub && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {item.sub}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Share Summary */}
        {todaySummary && navigator.share && (
          <button
            onClick={async () => {
              const s = todaySummary;
              const date = new Date().toLocaleDateString();
              const text = `BizPOS - ${businessName || t('business_name')}\n${date}\n${t('sales')}: ${s.transactionCount ?? 0} | ${t('total')}: ${sym}${(s.totalSales || 0).toLocaleString()}\n${t('profit')}: ${sym}${(s.totalProfit || 0).toLocaleString()}\n${t('cash')}: ${sym}${(s.cashTotal || 0).toLocaleString()} | ${t('bank')}: ${sym}${(s.bankTotal || 0).toLocaleString()}`;
              try { await navigator.share({ title: t('share_summary'), text }); } catch {}
            }}
            className="w-full py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            📲 {t('share_summary')}
          </button>
        )}

        {/* Financial Snapshot */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
            {t('financial_snapshot')}
          </h2>
          {finLoading ? (
            <SkeletonCard lines={7} />
          ) : (
            <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
              {financeItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.link)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {item.label}
                    </span>
                    {item.hint && (
                      <p className="text-[11px] text-[var(--text-secondary)] leading-tight mt-0.5">
                        {item.hint}
                      </p>
                    )}
                  </div>
                  <span className={`text-sm font-semibold ${item.color} whitespace-nowrap`}>
                    {formatCurrency(item.value, sym)}
                  </span>
                </button>
              ))}
              {/* Net Position */}
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {t('net_position')}
                </span>
                <span
                  className={`text-lg font-bold ${
                    financials.netPosition >= 0
                      ? 'text-[var(--success)]'
                      : 'text-[var(--danger)]'
                  }`}
                >
                  {formatCurrency(financials.netPosition, sym)}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Live Sales Feed */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
            {t('live_sales_feed')}
          </h2>
          <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
            {liveFeed.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                {t('no_sales_today')}
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-color)] max-h-80 overflow-y-auto">
                {liveFeed.map((tx, i) => {
                  const isCredit = tx.paymentMethod === 'credit';
                  const items =
                    tx.itemsSummary ||
                    (Array.isArray(tx.items)
                      ? tx.items.map((it) => it.name || it.product).join(', ')
                      : t('sale'));
                  return (
                    <div
                      key={tx.id || i}
                      className="px-4 py-3 flex items-start gap-3"
                    >
                      <span className="mt-0.5 text-base">
                        {isCredit ? '🔴' : '🟢'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {items}
                          </span>
                          <span className="text-sm font-semibold text-[var(--text-primary)] whitespace-nowrap">
                            {formatCurrency(tx.total ?? tx.amount, sym)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-secondary)]">
                          <span>{formatTime(tx.timestamp)}</span>
                          <span>·</span>
                          <span className="capitalize">
                            {t(tx.paymentMethod || 'cash')}
                          </span>
                          {tx.attendant && (
                            <>
                              <span>·</span>
                              <span>{tx.attendant}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
        <div className="max-w-3xl mx-auto flex">
          {bottomNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
                  isActive
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
