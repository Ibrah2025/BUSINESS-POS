import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useBarcode } from '../../hooks/useBarcode';
import api from '../../api/client';
import { useTranslation } from '../../i18n';

const BarcodeScanner = lazy(() => import('../../components/BarcodeScanner'));

const PAGE_SIZE = 30;

export default function QuickInventory() {
  const { t } = useTranslation();

  function stockBadge(qty) {
    if (qty <= 0) return { label: t('out_of_stock'), dot: '\uD83D\uDD34', cls: 'bg-red-100 text-red-800' };
    if (qty <= 5) return { label: t('low_stock'), dot: '\uD83D\uDFE1', cls: 'bg-yellow-100 text-yellow-800' };
    return { label: t('in_stock'), dot: '\uD83D\uDFE2', cls: 'bg-green-100 text-green-800' };
  }

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [highlightId, setHighlightId] = useState(null);
  const highlightRef = useRef(null);
  const debounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Fetch products
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/inventory')
      .then(({ data }) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : data.products || data.items || [];
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setProducts(items);
        setError('');
      })
      .catch(() => { if (!cancelled) setError(t('failed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Filter
  const filtered = products.filter((p) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(0, page * PAGE_SIZE);

  // Barcode scan handler
  const handleScan = useCallback((code) => {
    const match = products.find((p) => p.barcode === code);
    if (match) {
      setSearch(code);
      setDebouncedSearch(code);
      setHighlightId(match._id || match.id);
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      setTimeout(() => setHighlightId(null), 3000);
    } else {
      setSearch(code);
      setDebouncedSearch(code);
    }
  }, [products]);

  const {
    isCameraOpen,
    openCamera,
    closeCamera,
    onCameraScan,
  } = useBarcode({ onScan: handleScan });

  // Scroll to highlighted item when it renders
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border)] px-4 py-3">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">{t('quick_stock_check')}</h1>
      </header>

      <div className="px-3 pt-3 space-y-3">
        {/* Search */}
        <input
          type="text"
          placeholder={t('search_by_name_or_barcode')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-base outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />

        {/* Scan button */}
        <button
          onClick={openCamera}
          className="w-full py-3 rounded-xl bg-[var(--accent)] text-white text-base font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
        >
          <span className="text-xl">{'\uD83D\uDCF7'}</span> {t('scan_to_check')}
        </button>

        {/* Camera overlay */}
        {isCameraOpen && (
          <Suspense fallback={<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" /></div>}>
            <BarcodeScanner
              isOpen={isCameraOpen}
              onScan={(code) => { onCameraScan(code); }}
              onClose={closeCamera}
            />
          </Suspense>
        )}

        {/* Status */}
        {loading && <p className="text-center text-[var(--text-muted)] py-8">{t('loading_inventory')}</p>}
        {error && <p className="text-center text-red-500 py-8">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="text-center text-[var(--text-muted)] py-8">{t('no_products_found')}</p>
        )}

        {/* Product list */}
        {!loading && !error && visible.map((p) => {
          const id = p._id || p.id;
          const badge = stockBadge(p.quantity ?? p.stock ?? 0);
          const qty = p.quantity ?? p.stock ?? 0;
          const isHighlighted = highlightId === id;

          return (
            <div
              key={id}
              ref={isHighlighted ? highlightRef : undefined}
              className={`rounded-xl border p-3 transition-all ${
                isHighlighted
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--bg-secondary)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[var(--text-primary)] truncate">{p.name}</h3>
                  {p.barcode && (
                    <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{p.barcode}</p>
                  )}
                </div>
                <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${badge.cls}`}>
                  {badge.dot} {badge.label}
                </span>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold ${qty <= 0 ? 'text-red-500' : qty <= 5 ? 'text-yellow-600' : 'text-[var(--text-primary)]'}`}>
                    {qty}
                  </span>
                  {p.unit && <span className="text-sm text-[var(--text-muted)]">{p.unit}</span>}
                </div>
                {p.sellPrice != null && (
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {typeof p.sellPrice === 'number' ? `$${p.sellPrice.toFixed(2)}` : p.sellPrice}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Load more */}
        {!loading && page * PAGE_SIZE < filtered.length && (
          <button
            onClick={() => setPage((p) => p + 1)}
            className="w-full py-3 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-medium active:scale-[0.97] transition-transform"
          >
            {t('load_more')} ({filtered.length - visible.length} {t('remaining')})
          </button>
        )}
      </div>
    </div>
  );
}
