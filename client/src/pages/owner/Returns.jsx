import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import api from '../../api/client';
import { useTranslation } from '../../i18n';

function formatCurrency(amount, symbol = '\u20A6') {
  const num = Number(amount) || 0;
  return `${symbol}${num.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Returns() {
  const { t } = useTranslation();
  const { currency } = useSettingsStore();
  const sym = currency || '\u20A6';

  const REASONS = [t('reason_defective'), t('reason_wrong_item'), t('reason_changed_mind'), t('reason_other')];
  const REFUND_METHODS = [t('cash'), t('bank')];

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFlow, setShowFlow] = useState(false);
  const [step, setStep] = useState(1);

  // Flow state
  const [saleSearch, setSaleSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedItems, setSelectedItems] = useState({});
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [refundMethod, setRefundMethod] = useState(t('cash'));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/returns');
      setReturns(Array.isArray(data) ? data : data?.returns || []);
    } catch {
      setReturns([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const searchSales = async () => {
    if (!saleSearch.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.get(`/sales?search=${encodeURIComponent(saleSearch.trim())}`);
      setSearchResults(Array.isArray(data) ? data : data?.sales || []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const toggleItem = (itemIdx, maxQty) => {
    setSelectedItems((prev) => {
      const copy = { ...prev };
      if (copy[itemIdx]) {
        delete copy[itemIdx];
      } else {
        copy[itemIdx] = maxQty;
      }
      return copy;
    });
  };

  const setItemQty = (itemIdx, qty) => {
    setSelectedItems((prev) => ({ ...prev, [itemIdx]: qty }));
  };

  const refundTotal = selectedSale
    ? Object.entries(selectedItems).reduce((sum, [idx, qty]) => {
        const item = selectedSale.items?.[idx];
        if (!item) return sum;
        return sum + (item.price || 0) * qty;
      }, 0)
    : 0;

  const resetFlow = () => {
    setShowFlow(false);
    setStep(1);
    setSaleSearch('');
    setSearchResults([]);
    setSelectedSale(null);
    setSelectedItems({});
    setReason('');
    setCustomReason('');
    setRefundMethod(t('cash'));
    setError('');
  };

  const submitReturn = async () => {
    setSubmitting(true);
    setError('');
    try {
      const items = Object.entries(selectedItems).map(([idx, qty]) => {
        const item = selectedSale.items[idx];
        return {
          productId: item.productId || item._id || item.id,
          name: item.name || item.product,
          quantity: qty,
          price: item.price,
        };
      });
      await api.post('/returns', {
        saleId: selectedSale._id || selectedSale.id,
        items,
        reason: reason === t('reason_other') ? customReason || t('reason_other') : reason,
        refundMethod: refundMethod.toLowerCase(),
        refundAmount: refundTotal,
      });
      resetFlow();
      fetchReturns();
    } catch (err) {
      setError(err.response?.data?.message || t('failed'));
    }
    setSubmitting(false);
  };

  const canProceed = () => {
    if (step === 1) return !!selectedSale;
    if (step === 2) return Object.keys(selectedItems).length > 0;
    if (step === 3) return reason && (reason !== t('reason_other') || customReason.trim());
    return true;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-6">
      <header className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('returns_and_refunds')}</h1>
        {!showFlow && (
          <button
            onClick={() => setShowFlow(true)}
            className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium"
          >
            + {t('process_return')}
          </button>
        )}
      </header>

      <main className="px-4 py-4 max-w-3xl mx-auto space-y-4">
        {/* Process Return Flow */}
        {showFlow && (
          <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step >= s ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                  }`}>
                    {s}
                  </div>
                  {s < 4 && <div className={`w-6 h-0.5 ${step > s ? 'bg-[var(--accent)]' : 'bg-[var(--border-color)]'}`} />}
                </div>
              ))}
              <div className="flex-1" />
              <button onClick={resetFlow} className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)]">{t('cancel')}</button>
            </div>

            {/* Step 1: Find sale */}
            {step === 1 && (
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-2">{t('find_original_sale')}</p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder={t('enter_sale_id')}
                    value={saleSearch}
                    onChange={(e) => setSaleSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchSales()}
                    className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm placeholder:text-[var(--text-secondary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  <button
                    onClick={searchSales}
                    className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium"
                  >
                    {t('search')}
                  </button>
                </div>
                {searching && <p className="text-sm text-[var(--text-secondary)]">{t('searching')}</p>}
                {searchResults.length > 0 && (
                  <div className="max-h-60 overflow-y-auto divide-y divide-[var(--border-color)] rounded-lg border border-[var(--border-color)]">
                    {searchResults.map((sale) => {
                      const saleId = sale._id || sale.id;
                      const isSelected = (selectedSale?._id || selectedSale?.id) === saleId;
                      return (
                        <button
                          key={saleId}
                          onClick={() => setSelectedSale(sale)}
                          className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                            isSelected ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-secondary)]'
                          }`}
                        >
                          <div className="flex justify-between">
                            <span className="text-[var(--text-primary)] font-medium">
                              #{saleId?.slice?.(-6) || saleId}
                            </span>
                            <span className="font-semibold text-[var(--text-primary)]">
                              {formatCurrency(sale.total ?? sale.amount, sym)}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {formatDate(sale.createdAt || sale.date)} — {(sale.items || []).length} {t('items')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Select items */}
            {step === 2 && selectedSale && (
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-2">{t('select_items_to_return')}</p>
                <div className="space-y-2">
                  {(selectedSale.items || []).map((item, idx) => {
                    const checked = idx in selectedItems;
                    const maxQty = item.quantity || 1;
                    return (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg-secondary)]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(idx, maxQty)}
                          className="w-4 h-4 accent-[var(--accent)]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text-primary)] truncate">{item.name || item.product}</p>
                          <p className="text-xs text-[var(--text-secondary)]">{formatCurrency(item.price, sym)} {t('each')}</p>
                        </div>
                        {checked && (
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-[var(--text-secondary)]">{t('qty')}</label>
                            <select
                              value={selectedItems[idx] || 1}
                              onChange={(e) => setItemQty(idx, parseInt(e.target.value, 10))}
                              className="rounded border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] text-xs px-1 py-0.5"
                            >
                              {Array.from({ length: maxQty }, (_, i) => i + 1).map((q) => (
                                <option key={q} value={q}>{q}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Reason */}
            {step === 3 && (
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-2">{t('reason_for_return')}</p>
                <div className="space-y-2">
                  {REASONS.map((r) => (
                    <label key={r} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)] cursor-pointer">
                      <input
                        type="radio"
                        name="reason"
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        className="accent-[var(--accent)]"
                      />
                      <span className="text-sm text-[var(--text-primary)]">{r}</span>
                    </label>
                  ))}
                  {reason === t('reason_other') && (
                    <input
                      type="text"
                      placeholder={t('specify_reason')}
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Confirm */}
            {step === 4 && (
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-3">{t('confirm_return')}</p>
                <div className="space-y-3">
                  <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1">{t('items_being_returned')}</p>
                    {Object.entries(selectedItems).map(([idx, qty]) => {
                      const item = selectedSale.items[idx];
                      return (
                        <div key={idx} className="flex justify-between text-sm text-[var(--text-primary)] py-0.5">
                          <span>{item?.name || item?.product} x{qty}</span>
                          <span>{formatCurrency((item?.price || 0) * qty, sym)}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between text-sm font-semibold text-[var(--text-primary)]">
                    <span>{t('refund_amount')}</span>
                    <span className="text-[var(--danger)]">{formatCurrency(refundTotal, sym)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[var(--text-primary)]">{t('return_reason')}</span>
                    <span className="text-sm text-[var(--text-secondary)]">{reason === t('reason_other') ? customReason : reason}</span>
                  </div>

                  <div>
                    <p className="text-sm text-[var(--text-primary)] mb-1">{t('refund_method')}</p>
                    <div className="flex gap-2">
                      {REFUND_METHODS.map((m) => (
                        <button
                          key={m}
                          onClick={() => setRefundMethod(m)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            refundMethod === m
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                              : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-color)]'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-4 pt-3 border-t border-[var(--border-color)]">
              <button
                onClick={() => step > 1 ? setStep((s) => s - 1) : resetFlow()}
                className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {step === 1 ? t('cancel') : t('back')}
              </button>
              {step < 4 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canProceed()}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-40"
                >
                  {t('next')}
                </button>
              ) : (
                <button
                  onClick={submitReturn}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[var(--danger)] text-white text-sm font-medium disabled:opacity-40"
                >
                  {submitting ? t('processing') : t('confirm_return')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Returns list */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">{t('return_history')}</h2>
          {loading ? (
            <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center text-sm text-[var(--text-secondary)]">{t('loading')}</div>
          ) : returns.length === 0 ? (
            <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center text-sm text-[var(--text-secondary)]">{t('no_returns')}</div>
          ) : (
            <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
              {returns.map((ret, idx) => {
                const id = ret._id || ret.id || idx;
                return (
                  <div key={id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {t('return_number')}{typeof id === 'string' ? id.slice(-6) : id}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {formatDate(ret.createdAt || ret.date)} — {t('sale_ref')}#{(ret.saleId || '').toString().slice(-6)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--danger)]">
                        -{formatCurrency(ret.refundAmount ?? ret.amount, sym)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                        {(ret.items || []).reduce((s, i) => s + (i.quantity || 1), 0)} {t('items')}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 capitalize">
                        {ret.refundMethod || 'cash'}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {ret.reason}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
