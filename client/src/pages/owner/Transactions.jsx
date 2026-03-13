import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
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

function generateCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let week = new Array(firstDay).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function PaymentBadge({ method }) {
  const { t } = useTranslation();
  const colors = {
    cash: 'bg-green-100 text-green-800',
    bank: 'bg-blue-100 text-blue-800',
    credit: 'bg-orange-100 text-orange-800',
    transfer: 'bg-purple-100 text-purple-800',
  };
  const cls = colors[method?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls} capitalize`}>
      {t(method || 'cash')}
    </span>
  );
}

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const colors = {
    completed: 'bg-green-100 text-green-700',
    returned: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  };
  const cls = colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls} capitalize`}>
      {t(status || 'completed')}
    </span>
  );
}

export default function Transactions() {
  const { t } = useTranslation();
  const { currency } = useSettingsStore();
  const sym = currency || '\u20A6';

  const MONTHS = [t('month_january'), t('month_february'), t('month_march'), t('month_april'), t('month_may'), t('month_june'), t('month_july'), t('month_august'), t('month_september'), t('month_october'), t('month_november'), t('month_december')];
  const DAYS = [t('day_sun'), t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri'), t('day_sat')];
  const PAYMENT_FILTERS = [t('all'), t('cash'), t('bank'), t('credit'), t('returned')];

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [calendarData, setCalendarData] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayTransactions, setDayTransactions] = useState([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [calLoading, setCalLoading] = useState(true);
  const [expandedTx, setExpandedTx] = useState(null);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState(t('all'));

  const fetchCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const { data } = await api.get(`/sales/calendar/${year}/${month + 1}`);
      const map = {};
      if (Array.isArray(data)) {
        data.forEach((d) => { map[d.day] = d; });
      } else if (data && typeof data === 'object') {
        Object.entries(data).forEach(([key, val]) => {
          const dayNum = parseInt(key, 10);
          if (!isNaN(dayNum)) map[dayNum] = typeof val === 'object' ? val : { total: val, count: 1 };
        });
      }
      setCalendarData(map);
    } catch {
      setCalendarData({});
    }
    setCalLoading(false);
  }, [year, month]);

  const fetchDayDetail = useCallback(async (day) => {
    setDayLoading(true);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    try {
      const { data } = await api.get(`/sales?date=${dateStr}`);
      setDayTransactions(Array.isArray(data) ? data : data?.sales || []);
    } catch {
      setDayTransactions([]);
    }
    setDayLoading(false);
  }, [year, month]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  useEffect(() => {
    if (selectedDay) fetchDayDetail(selectedDay);
  }, [selectedDay, fetchDayDetail]);

  const prevMonth = () => {
    setSelectedDay(null);
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    setSelectedDay(null);
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const weeks = generateCalendar(year, month);
  const today = new Date();
  const isToday = (d) => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  const filteredTx = dayTransactions.filter((tx) => {
    if (paymentFilter !== t('all')) {
      const m = (tx.paymentMethod || 'cash').toLowerCase();
      const s = (tx.status || '').toLowerCase();
      if (paymentFilter === t('returned') && s !== 'returned') return false;
      if (paymentFilter !== t('returned') && m !== paymentFilter.toLowerCase()) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const haystack = [
        tx.attendant, tx.customerName, tx.paymentMethod, tx.status,
        ...(tx.items || []).map((i) => i.name || i.product || ''),
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-6">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('sales_history')}</h1>
      </header>

      <main className="px-4 py-4 max-w-3xl mx-auto space-y-4">
        {/* Month selector */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-primary)] text-lg font-bold">&lt;</button>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-primary)] text-lg font-bold">&gt;</button>
        </div>

        {/* Calendar */}
        <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-[var(--text-secondary)] uppercase">{d}</div>
            ))}
          </div>

          {calLoading ? (
            <div className="py-12 text-center text-sm text-[var(--text-secondary)]">{t('loading')}</div>
          ) : (
            weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((day, di) => {
                  if (!day) return <div key={di} />;
                  const info = calendarData[day];
                  const selected = selectedDay === day;
                  return (
                    <button
                      key={di}
                      onClick={() => setSelectedDay(day)}
                      className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg text-xs transition-colors ${
                        selected
                          ? 'bg-[var(--accent)] text-white'
                          : isToday(day)
                          ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                      }`}
                    >
                      <span className="font-medium">{day}</span>
                      {info && (
                        <>
                          <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${selected ? 'bg-white' : 'bg-[var(--accent)]'}`} />
                          <span className={`text-[8px] mt-0.5 ${selected ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}>
                            {info.count || 0}{t('tx')}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Day detail */}
        {selectedDay && (
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              {MONTHS[month]} {selectedDay}, {year}
              {calendarData[selectedDay] && (
                <span className="ml-2 normal-case font-normal">
                  — {calendarData[selectedDay].count || 0} {t('sales')}, {formatCurrency(calendarData[selectedDay].total || 0, sym)}
                </span>
              )}
            </h3>

            {/* Search and filter */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder={t('search_transactions')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm placeholder:text-[var(--text-secondary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-2 py-2 text-sm outline-none"
              >
                {PAYMENT_FILTERS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {dayLoading ? (
              <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center text-sm text-[var(--text-secondary)]">{t('loading')}</div>
            ) : filteredTx.length === 0 ? (
              <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center text-sm text-[var(--text-secondary)]">{t('no_transactions_found')}</div>
            ) : (
              <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
                {filteredTx.map((tx, idx) => {
                  const id = tx._id || tx.id || idx;
                  const expanded = expandedTx === id;
                  const items = tx.items || [];
                  return (
                    <div key={id}>
                      <button
                        onClick={() => setExpandedTx(expanded ? null : id)}
                        className="w-full px-4 py-3 text-left hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
                              {formatTime(tx.createdAt || tx.timestamp || tx.date)}
                            </span>
                            <span className="text-sm text-[var(--text-primary)] truncate">
                              {items.length} {t('items')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold text-[var(--text-primary)]">
                              {formatCurrency(tx.total ?? tx.amount, sym)}
                            </span>
                            <span className="text-xs text-[var(--text-secondary)]">{expanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <PaymentBadge method={tx.paymentMethod} />
                          <StatusBadge status={tx.status} />
                          {tx.attendant && (
                            <span className="text-[10px] text-[var(--text-secondary)]">{tx.attendant}</span>
                          )}
                        </div>
                      </button>

                      {expanded && (
                        <div className="px-4 pb-3 space-y-2">
                          {items.length > 0 && (
                            <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
                              <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-1">{t('items')}</p>
                              {items.map((item, ii) => (
                                <div key={ii} className="flex justify-between text-xs text-[var(--text-primary)] py-0.5">
                                  <span>{item.name || item.product} x{item.quantity || 1}</span>
                                  <span>{formatCurrency(item.subtotal ?? (item.price || 0) * (item.quantity || 1), sym)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {tx.payments && tx.payments.length > 0 && (
                            <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
                              <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-1">{t('payments')}</p>
                              {tx.payments.map((p, pi) => (
                                <div key={pi} className="flex justify-between text-xs text-[var(--text-primary)] py-0.5">
                                  <span className="capitalize">{p.method}</span>
                                  <span>{formatCurrency(p.amount, sym)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {(tx.customerName || tx.customer) && (
                            <div className="text-xs text-[var(--text-secondary)]">
                              {t('customer')} <span className="text-[var(--text-primary)]">{tx.customerName || tx.customer}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
