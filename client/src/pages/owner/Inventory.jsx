import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { useInventoryStore } from '../../store/inventoryStore';
import { useAuthStore } from '../../store/authStore';
import { useBarcode } from '../../hooks/useBarcode';
import { useTranslation } from '../../i18n';
import api from '../../api/client';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

const UNITS = ['pcs', 'kg', 'g', 'litres', 'ml', 'pack', 'box', 'carton', 'dozen', 'bag', 'roll', 'bottle', 'sachet'];

const emptyProduct = {
  name: '',
  barcode: '',
  category: '',
  unit: 'pcs',
  buyPrice: '',
  sellPrice: '',
  quantity: '',
  lowStockThreshold: 5,
};

function formatPrice(v) {
  const n = Number(v);
  if (isNaN(n)) return '\u20A60';
  return '\u20A6' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function stockBadge(qty, threshold) {
  if (qty <= 0) return { labelKey: 'out_of_stock', dot: 'bg-red-500', bg: 'bg-red-500/10 text-red-400' };
  if (qty <= threshold) return { labelKey: 'low_stock', dot: 'bg-yellow-500', bg: 'bg-yellow-500/10 text-yellow-400' };
  return { labelKey: 'in_stock', dot: 'bg-green-500', bg: 'bg-green-500/10 text-green-400' };
}

function profitMargin(buy, sell) {
  const b = Number(buy), s = Number(sell);
  if (!b || !s || b <= 0) return '—';
  return (((s - b) / b) * 100).toFixed(1) + '%';
}

// ─── Inline Editable Cell ────────────────────────────────────────────
function EditableCell({ value, onSave, prefix = '', type = 'text', className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    const parsed = type === 'number' ? Number(draft) : draft;
    if (parsed !== value) onSave(parsed);
  };

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:bg-[var(--bg-primary)] px-1.5 py-0.5 rounded transition-colors ${className}`}
        onClick={() => { setDraft(value); setEditing(true); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && (setDraft(value), setEditing(true))}
      >
        {prefix}{type === 'number' ? Number(value).toLocaleString() : value}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className="w-20 px-1.5 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--accent)] text-[var(--text-primary)] text-sm outline-none"
      step={type === 'number' ? 'any' : undefined}
    />
  );
}

// ─── Product Modal ───────────────────────────────────────────────────
function ProductModal({ product, categories, onClose, onSave, onDelete, isOwner, t }) {
  const isEdit = !!product?.id;
  const [form, setForm] = useState(isEdit ? {
    name: product.name || '',
    barcode: product.barcode || '',
    category: product.category || '',
    unit: product.unit || 'pcs',
    buyPrice: product.buyPrice ?? '',
    sellPrice: product.sellPrice ?? '',
    quantity: product.quantity ?? '',
    lowStockThreshold: product.lowStockThreshold ?? 5,
  } : { ...emptyProduct });
  const [customCategory, setCustomCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { openCamera, isCameraOpen, closeCamera, onCameraScan, scannedCode } = useBarcode({
    onScan: (code) => setForm((f) => ({ ...f, barcode: code })),
  });

  useEffect(() => {
    if (scannedCode) setForm((f) => ({ ...f, barcode: scannedCode }));
  }, [scannedCode]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const profit = useMemo(() => {
    const b = Number(form.buyPrice), s = Number(form.sellPrice);
    if (!b || !s) return null;
    return { amount: s - b, pct: ((s - b) / b * 100).toFixed(1) };
  }, [form.buyPrice, form.sellPrice]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(t('product_name_required'));
    if (!form.sellPrice || Number(form.sellPrice) <= 0) return setError(t('sell_price_required'));
    if (!isEdit && (!form.quantity || Number(form.quantity) <= 0)) return setError(t('quantity_required'));
    setError('');
    setSaving(true);
    try {
      await onSave({
        ...form,
        buyPrice: Number(form.buyPrice) || 0,
        sellPrice: Number(form.sellPrice) || 0,
        quantity: Number(form.quantity) || 0,
        lowStockThreshold: Number(form.lowStockThreshold) || 5,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('failed_to_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-70" />

      {/* Modal */}
      <div
        className="relative z-[10000] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-gray-200 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Camera overlay */}
        {isCameraOpen && (
          <div className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center rounded-2xl">
            <p className="text-white mb-4 text-sm">{t('scan')}</p>
            <div className="w-64 h-64 border-2 border-white/50 rounded-lg" />
            <button onClick={closeCamera} className="mt-4 px-4 py-2 bg-white/20 text-white rounded-lg text-sm">{t('cancel')}</button>
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? t('edit_product') : t('add_product')}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-xl">&times;</button>
        </div>

        {error && <p className="text-sm text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Name */}
          <label className="block">
            <span className="text-xs text-gray-600 mb-1 block font-medium">{t('product_name')} *</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 transition-colors"
              placeholder={t('product_name_placeholder')} />
          </label>

          {/* Barcode */}
          <label className="block">
            <span className="text-xs text-gray-600 mb-1 block font-medium">{t('barcode')}</span>
            <div className="flex gap-2">
              <input value={form.barcode} onChange={(e) => set('barcode', e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                placeholder={t('scan_or_type_barcode')} />
              <button type="button" onClick={openCamera}
                className="px-3 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium shrink-0"
                title={t('scan_barcode')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 8h10M7 12h10M7 16h6" /></svg>
              </button>
            </div>
          </label>

          {/* Category & Unit — edit mode only */}
          {isEdit && (
            <>
              <label className="block">
                <span className="text-xs text-gray-600 mb-1 block font-medium">{t('category')}</span>
                {customCategory ? (
                  <div className="flex gap-2">
                    <input value={form.category} onChange={(e) => set('category', e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                      placeholder={t('new_category_name')} autoFocus />
                    <button type="button" onClick={() => setCustomCategory(false)} className="text-xs text-green-600 font-medium">{t('list')}</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select value={form.category} onChange={(e) => set('category', e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600">
                      <option value="">{t('select_category')}</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => setCustomCategory(true)} className="text-xs text-green-600 font-medium whitespace-nowrap">{t('new_category')}</button>
                  </div>
                )}
              </label>

              <label className="block">
                <span className="text-xs text-gray-600 mb-1 block font-medium">{t('unit')}</span>
                <select value={form.unit} onChange={(e) => set('unit', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
            </>
          )}

          {/* Prices row */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-600 mb-1 block font-medium">{t('buy_price')} (₦)</span>
              <input type="number" min="0" step="any" value={form.buyPrice} onChange={(e) => set('buyPrice', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                placeholder="0" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600 mb-1 block font-medium">{t('sell_price')} (₦) *</span>
              <input type="number" min="0" step="any" value={form.sellPrice} onChange={(e) => set('sellPrice', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                placeholder="0" />
            </label>
          </div>

          {/* Profit preview */}
          {profit && (
            <div className={`text-xs px-3 py-2 rounded-lg font-medium ${profit.amount >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {t('profit')}: {formatPrice(profit.amount)} ({profit.pct}%)
            </div>
          )}

          {/* Quantity (+ Low Stock in edit mode) */}
          <div className={`grid gap-3 ${isEdit ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <label className="block">
              <span className="text-xs text-gray-600 mb-1 block font-medium">{t('quantity')} {!isEdit && '*'}</span>
              <input type="number" min="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                placeholder="0" />
            </label>
            {isEdit && (
              <label className="block">
                <span className="text-xs text-gray-600 mb-0.5 block font-medium">{t('low_stock_alert')}</span>
                <span className="text-[10px] text-gray-400 block mb-1">{t('low_stock_alert_hint')}</span>
                <input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                  placeholder="5" />
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {isEdit && isOwner && (
              <button type="button"
                onClick={() => { if (window.confirm(t('delete_product_confirm'))) onDelete(product.id); onClose(); }}
                className="px-4 py-2.5 rounded-lg border border-red-500 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
                {t('delete')}
              </button>
            )}
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {saving ? t('saving') : isEdit ? t('edit_product') : t('add_product')}
            </button>
          </div>
        </form>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
    </div>
  );
}

// ─── Delete Confirmation on Swipe ────────────────────────────────────
function SwipeRow({ children, onDelete, deleteLabel = 'Delete' }) {
  const rowRef = useRef(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; swiping.current = true; };
  const onTouchMove = (e) => {
    if (!swiping.current) return;
    currentX.current = e.touches[0].clientX;
    const dx = Math.min(0, currentX.current - startX.current);
    if (dx < -20 && rowRef.current) rowRef.current.style.transform = `translateX(${Math.max(dx, -100)}px)`;
  };
  const onTouchEnd = () => {
    swiping.current = false;
    const dx = currentX.current - startX.current;
    if (rowRef.current) rowRef.current.style.transform = '';
    if (dx < -80) onDelete();
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute right-0 inset-y-0 w-24 bg-[var(--danger)] flex items-center justify-center text-white text-xs font-medium rounded-r-xl">{deleteLabel}</div>
      <div ref={rowRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        className="relative bg-[var(--card-bg)] transition-transform duration-200">
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function Inventory() {
  const { t } = useTranslation();
  const { products, categories, setProducts, addProduct, updateProduct, removeProduct, setSearchQuery, setCategory, selectedCategory } = useInventoryStore();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'owner';

  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [modalProduct, setModalProduct] = useState(null); // null = closed, {} = add new, product = edit
  const [serverSearching, setServerSearching] = useState(false);
  const debounceRef = useRef(null);
  const sentinelRef = useRef(null);

  // ── Fetch products on mount ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/inventory');
        if (!cancelled) setProducts(Array.isArray(data) ? data : data.products || []);
      } catch (err) {
        console.error('Failed to load inventory:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setProducts]);

  // ── Debounced search ──
  const handleSearch = useCallback((value) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value);
      setVisibleCount(PAGE_SIZE);
      // Server-side search for deeper results if input is long enough
      if (value.length >= 3) {
        setServerSearching(true);
        api.get('/inventory', { params: { search: value } })
          .then(({ data }) => {
            const serverProducts = Array.isArray(data) ? data : data.products || [];
            // Merge server results into store (avoid duplicates)
            const existing = new Set(useInventoryStore.getState().products.map((p) => p.id));
            const newOnes = serverProducts.filter((p) => !existing.has(p.id));
            if (newOnes.length) {
              useInventoryStore.setState((s) => ({ products: [...s.products, ...newOnes] }));
            }
          })
          .catch(() => {})
          .finally(() => setServerSearching(false));
      }
    }, DEBOUNCE_MS);
  }, [setSearchQuery]);

  // ── Filtered products from store ──
  const filtered = useMemo(() => {
    const { products: all, searchQuery, selectedCategory: cat } = useInventoryStore.getState();
    return all.filter((p) => {
      const matchSearch = !searchQuery
        || p.name.toLowerCase().includes(searchQuery.toLowerCase())
        || (p.barcode && p.barcode.includes(searchQuery));
      const matchCat = !cat || p.category === cat;
      return matchSearch && matchCat;
    });
  }, [products, useInventoryStore().searchQuery, selectedCategory]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  // ── Infinite scroll via IntersectionObserver ──
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount((c) => c + PAGE_SIZE);
    }, { rootMargin: '200px' });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, visible.length]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = products.length;
    const lowStock = products.filter((p) => p.quantity > 0 && p.quantity <= (p.lowStockThreshold || 5)).length;
    const outOfStock = products.filter((p) => p.quantity <= 0).length;
    const value = products.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.buyPrice) || 0), 0);
    return { total, lowStock, outOfStock, value };
  }, [products]);

  // ── CRUD handlers ──
  const handleSave = async (formData) => {
    if (modalProduct?.id) {
      const { data } = await api.put(`/inventory/${modalProduct.id}`, formData);
      updateProduct(modalProduct.id, data.product || data || formData);
    } else {
      const { data } = await api.post('/inventory', formData);
      addProduct(data.product || data);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/inventory/${id}`);
      removeProduct(id);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const [labelBusy, setLabelBusy] = useState(false);

  const handlePrintLabels = async () => {
    setLabelBusy(true);
    try {
      const response = await api.get('/export/barcode-labels', { responseType: 'blob' });
      const blob = response.data;

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });

        const fileName = `barcode-labels-${new Date().toISOString().slice(0, 10)}.html`;
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: fileName,
          url: result.uri,
          dialogTitle: t('print_labels') || 'Print Labels',
        });
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch {
      alert(t('export_failed') || 'Export failed');
    }
    setLabelBusy(false);
  };

  const handleInlineUpdate = async (id, field, value) => {
    updateProduct(id, { [field]: value });
    try {
      await api.put(`/inventory/${id}`, { [field]: value });
    } catch {
      // Revert on failure — refetch
      const { data } = await api.get('/inventory');
      setProducts(Array.isArray(data) ? data : data.products || []);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-4 pb-2">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-[var(--text-primary)]">{stats.total}</p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t('total_products')}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-3 text-center">
          <p className={`text-xl font-bold ${stats.lowStock + stats.outOfStock > 0 ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'}`}>
            {stats.lowStock + stats.outOfStock}
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t('low_out')}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-[var(--text-primary)]">{formatPrice(stats.value)}</p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t('inventory_value')}</p>
        </div>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('inventory')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={handlePrintLabels} disabled={labelBusy}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-secondary)] text-xs font-medium transition-colors disabled:opacity-50"
            title={t('print_labels')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10M7 16h6M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" /></svg>
            {labelBusy ? '...' : t('print_labels')}
          </button>
          <button onClick={() => setModalProduct({})}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-md transition-colors">
            <span className="text-lg leading-none">+</span> {t('add_product')}
          </button>
        </div>
      </div>

      {/* ── Search + Category Filter ── */}
      <div className="px-4 space-y-2 mb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('search_products')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent)] transition-colors"
          />
          {serverSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setCategory(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !selectedCategory ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--border-color)]'
              }`}>
              {t('all')}
            </button>
            {categories.map((cat) => (
              <button key={cat}
                onClick={() => setCategory(selectedCategory === cat ? null : cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--border-color)]'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Product List ── */}
      <div className="px-4 space-y-2">
        {visible.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[var(--text-secondary)] text-sm">
              {t('no_products')}
            </p>
          </div>
        )}

        {visible.map((p) => {
          const badge = stockBadge(p.quantity, p.lowStockThreshold || 5);
          return (
            <SwipeRow key={p.id} onDelete={() => { if (isOwner && window.confirm(t('delete_product_confirm'))) handleDelete(p.id); }} deleteLabel={t('delete')}>
              <div
                className="border border-[var(--border-color)] rounded-xl p-3 cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => setModalProduct(p)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{p.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {t(badge.labelKey)}
                      </span>
                    </div>
                    {p.barcode && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 font-mono">{p.barcode}</p>}
                    {p.category && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{p.category}</p>}
                  </div>
                </div>

                {/* Inline-editable fields */}
                <div className="grid grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-[var(--border-color)]" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">{t('buy_price')}</p>
                    <EditableCell
                      value={p.buyPrice || 0}
                      type="number"
                      prefix={'\u20A6'}
                      onSave={(v) => handleInlineUpdate(p.id, 'buyPrice', v)}
                      className="text-xs text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">{t('sell_price')}</p>
                    <EditableCell
                      value={p.sellPrice || 0}
                      type="number"
                      prefix={'\u20A6'}
                      onSave={(v) => handleInlineUpdate(p.id, 'sellPrice', v)}
                      className="text-xs text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">{t('quantity')}</p>
                    <EditableCell
                      value={p.quantity || 0}
                      type="number"
                      onSave={(v) => handleInlineUpdate(p.id, 'quantity', v)}
                      className="text-xs text-[var(--text-primary)] font-medium"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">{t('profit_margin')}</p>
                    <span className={`text-xs font-medium ${Number(p.sellPrice) >= Number(p.buyPrice) ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                      {profitMargin(p.buyPrice, p.sellPrice)}
                    </span>
                  </div>
                </div>
              </div>
            </SwipeRow>
          );
        })}

        {/* Infinite scroll sentinel */}
        {hasMore && <div ref={sentinelRef} className="flex justify-center py-4">
          <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] text-xs">
            {t('load_more')} ({filtered.length - visibleCount} {t('remaining')})
          </button>
        </div>}
      </div>

      {/* ── Product Modal ── */}
      {modalProduct !== null && (
        <ProductModal
          product={modalProduct}
          categories={categories}
          onClose={() => setModalProduct(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          isOwner={isOwner}
          t={t}
        />
      )}

      {/* Hide scrollbar for category chips */}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
}
