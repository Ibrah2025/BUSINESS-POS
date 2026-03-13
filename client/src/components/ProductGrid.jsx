import { useState, useMemo } from 'react';
import { useTranslation } from '../i18n';

export default function ProductGrid({ products = [], onSelect, isOpen, onClose }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }, [products, search]);

  if (!isOpen) return null;

  const stockBorder = (p) => {
    const qty = p.quantity ?? p.stock ?? 0;
    if (qty <= 0) return 'border-red-500';
    if (qty <= 5) return 'border-yellow-500';
    return 'border-green-500';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center text-[var(--text-primary)] text-xl font-bold"
        >
          &times;
        </button>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search_products')}
          autoFocus
          className="flex-1 h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <p className="text-center text-[var(--text-secondary)] text-sm mt-8">
            {t('no_products_found')}
          </p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {filtered.map((p) => {
              const qty = p.quantity ?? p.stock ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelect(p)}
                  disabled={qty <= 0}
                  className={`flex flex-col items-center p-2 rounded-lg border-2 ${stockBorder(p)} bg-[var(--bg-secondary)] text-center active:scale-95 transition-transform disabled:opacity-40`}
                >
                  <p className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2 leading-tight mb-1">
                    {p.name}
                  </p>
                  <p className="text-sm font-black text-[var(--accent)]">
                    {'\u20A6'}{(p.sellingPrice ?? p.price ?? 0).toLocaleString()}
                  </p>
                  <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {qty} {t('in_stock')}
                  </span>
                  {p.category && (
                    <span className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--bg-tertiary)] text-[var(--text-secondary)] uppercase">
                      {p.category}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
