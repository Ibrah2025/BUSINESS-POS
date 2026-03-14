import { useState, useEffect, useRef, useCallback, useMemo, memo, lazy, Suspense } from 'react';
import { useSalesStore } from '../../store/salesStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useBarcode } from '../../hooks/useBarcode';
import { useOffline } from '../../hooks/useOffline';
import { useSound } from '../../hooks/useSound';
import { playBeep, playKaChing, playCartPop } from '../../utils/sound';
import { hapticLight, hapticSuccess, hapticError } from '../../utils/haptic';
import { useVoice } from '../../hooks/useVoice';
const BarcodeScanner = lazy(() => import('../../components/BarcodeScanner'));
import ProductGrid from '../../components/ProductGrid';
import Receipt from '../../components/Receipt';
import ProfitToast from '../../components/ProfitToast';
import api from '../../api/client';
import { useTranslation } from '../../i18n';
import { enqueue } from '../../api/offlineQueue';
import { isConnected as isESP32Connected, sendSaleNotification } from '../../services/esp32';

// ─── Cart Item (memoized) ───────────────────────────────────────────────────
const CartItem = memo(function CartItem({
  item,
  currency,
  onRemove,
  onUpdateQty,
  t,
}) {
  const [editing, setEditing] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const lineTotal = item.unitPrice * item.quantity;

  const handleTouchStart = (e) => setTouchStartX(e.touches[0].clientX);
  const handleTouchMove = (e) => {
    if (touchStartX === null) return;
    const dx = e.touches[0].clientX - touchStartX;
    if (dx < 0) setSwipeOffset(Math.max(dx, -100));
  };
  const handleTouchEnd = () => {
    if (swipeOffset < -60) onRemove(item.productId);
    setSwipeOffset(0);
    setTouchStartX(null);
  };

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Delete backdrop - only visible when swiping */}
      {swipeOffset < 0 && (
        <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-center bg-red-500 text-white text-sm font-bold">
          {t('remove')}
        </div>
      )}

      <div
        className="relative flex items-center gap-2 p-3 bg-[var(--card-bg)] border-b border-[var(--border-color)] transition-transform"
        style={{ transform: `translateX(${swipeOffset}px)` }}
      >
        {/* Name + price */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {item.name}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {currency}{Math.round(item.unitPrice).toLocaleString()}
          </p>
        </div>

        {/* Quantity controls */}
        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <button
                onClick={() => onUpdateQty(item.productId, item.quantity - 1)}
                disabled={item.quantity <= 1}
                className="w-7 h-7 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] text-lg font-bold flex items-center justify-center disabled:opacity-30"
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={item.quantity}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (v >= 1) onUpdateQty(item.productId, v);
                }}
                onBlur={() => setEditing(false)}
                autoFocus
                className="w-10 h-7 text-center text-sm rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              />
              <button
                onClick={() => onUpdateQty(item.productId, item.quantity + 1)}
                className="w-7 h-7 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] text-lg font-bold flex items-center justify-center"
              >
                +
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-2 h-7 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-semibold min-w-[2rem] text-center"
            >
              x{item.quantity}
            </button>
          )}
        </div>

        {/* Line total */}
        <p className="text-sm font-bold text-[var(--text-primary)] w-20 text-right shrink-0">
          {currency}{lineTotal.toLocaleString()}
        </p>

        {/* Remove button */}
        <button
          onClick={() => onRemove(item.productId)}
          className="w-6 h-6 flex items-center justify-center text-red-400 text-lg shrink-0"
          aria-label={t('remove')}
        >
          &times;
        </button>
      </div>
    </div>
  );
});

// ─── Quick Add: unknown barcode scanned ─────────────────────────────────────
function QuickAddModal({ barcode, t, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputCls = 'w-full px-3 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-base outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]';

  const handleSave = async () => {
    if (!name.trim()) return setError(t('product_name_required'));
    if (!sellPrice || Number(sellPrice) <= 0) return setError(t('sell_price_required'));
    if (!quantity || Number(quantity) <= 0) return setError(t('quantity_required'));
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/inventory', {
        name: name.trim(),
        barcode,
        sellPrice: Number(sellPrice),
        buyPrice: Number(buyPrice) || 0,
        quantity: Number(quantity),
      });
      onSaved(data.product || data);
    } catch (err) {
      const d = err.response?.data;
      setError((typeof d?.message === 'string' && d.message) || d?.error?.message || t('failed_to_save'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-[10000] w-full max-w-md rounded-t-2xl bg-[var(--bg-secondary)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[var(--text-primary)]">{t('new_product')}</h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] text-xl">&times;</button>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-3 bg-[var(--bg-primary)] px-3 py-2 rounded-lg font-mono">{t('barcode')}: {barcode}</p>

        <div className="space-y-3">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder={t('product_name')} className={inputCls} autoFocus
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              type="number" inputMode="numeric" min="0"
              value={sellPrice} onChange={(e) => setSellPrice(e.target.value)}
              placeholder={`${t('sell_price')} *`} className={inputCls}
            />
            <input
              type="number" inputMode="numeric" min="0"
              value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)}
              placeholder={t('buy_price')} className={inputCls}
            />
            <input
              type="number" inputMode="numeric" min="1"
              value={quantity} onChange={(e) => setQuantity(e.target.value)}
              placeholder={`${t('quantity')} *`} className={inputCls}
            />
          </div>
          {error && <p className="text-sm text-[var(--danger,#dc2626)] text-center">{error}</p>}
          <button
            onClick={handleSave} disabled={saving}
            className="w-full py-3 rounded-lg bg-[var(--accent)] active:opacity-80 text-white font-bold text-base disabled:opacity-50"
          >
            {saving ? '...' : t('add_and_sell')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function ScanSell() {
  const {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    currentPaymentMethod,
    setPaymentMethod,
    selectedBankId,
    setSelectedBankId,
    customerName,
    setCustomerName,
    splitConfig,
    setSplitConfig,
  } = useSalesStore();

  const businessName = useSettingsStore((s) => s.businessName);
  const currency = useSettingsStore((s) => s.currency);
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'owner';
  const canAddProducts = user?.role === 'owner' || user?.role === 'manager';
  const { t } = useTranslation();

  const { isOffline, showBanner, isOnline, dismissBanner } = useOffline();
  const { playSuccess, playError } = useSound();
  const { speakSaleComplete } = useVoice();

  const [menuOpen, setMenuOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saleLoading, setSaleLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [banksLoaded, setBanksLoaded] = useState(false);
  const [productGridOpen, setProductGridOpen] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [profitToast, setProfitToast] = useState({ visible: false, amount: 0 });
  const [topProducts, setTopProducts] = useState([]);
  const [rageDiscount, setRageDiscount] = useState(0);
  const [quickAdd, setQuickAdd] = useState(null); // { barcode } when scanned barcode not found
  const [addingBank, setAddingBank] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBankAcct, setNewBankAcct] = useState('');
  const [newBankBal, setNewBankBal] = useState('');
  const [bankSaving, setBankSaving] = useState(false);

  const handleAddBank = async (selectFn) => {
    if (!newBankName.trim()) return;
    setBankSaving(true);
    try {
      const { data } = await api.post('/accounts', {
        bankName: newBankName.trim(),
        accountNumber: newBankAcct.trim() || undefined,
        balance: Number(newBankBal) || 0,
      });
      const created = data.account || data;
      setBankAccounts((prev) => [...prev, created]);
      selectFn(created.id);
      setAddingBank(false);
      setNewBankName('');
      setNewBankAcct('');
      setNewBankBal('');
    } catch (err) {
      const d = err.response?.data;
      showToast((typeof d?.message === 'string' && d.message) || d?.error?.message || t('failed_to_save'), 'error');
    } finally {
      setBankSaving(false);
    }
  };

  const manualInputRef = useRef(null);
  const [kbOpen, setKbOpen] = useState(false);
  const toastTimer = useRef(null);

  // Computed cart total
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );
  const cartProfit = useMemo(
    () => cart.reduce((sum, item) => sum + item.profit * item.quantity, 0),
    [cart]
  );

  // Reset rage discount when cart changes
  useEffect(() => { setRageDiscount(0); }, [cart]);

  // Rage: round down total for regular customers
  const finalTotal = cartTotal - rageDiscount;
  const handleRage = () => {
    if (cartTotal <= 0) return;
    // Cycle: round to nearest 50, then 100, then 500, then reset
    const steps = [50, 100, 500];
    for (const step of steps) {
      const rounded = Math.floor(cartTotal / step) * step;
      const disc = cartTotal - rounded;
      if (disc > rageDiscount && disc > 0) { setRageDiscount(disc); return; }
    }
    setRageDiscount(0); // reset
  };

  // Show toast helper
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Lookup product by barcode
  // Ref to close camera from within lookupProduct (avoids circular dep)
  const closeCameraRef = useRef(null);

  // Cache barcode → product to skip redundant API calls on repeat scans
  const productCacheRef = useRef(new Map());
  const CACHE_TTL = 60_000; // 60s cache lifetime

  const lookupProduct = useCallback(
    async (code) => {
      if (!code) return;
      setLookupLoading(true);
      try {
        let product;

        // Check cache first — avoid API call for recently scanned barcodes
        const cached = productCacheRef.current.get(code);
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          product = cached.product;
        } else {
          const { data } = await api.get(`/inventory/barcode/${encodeURIComponent(code)}`);
          product = data.product || data;
          if (product?.id) {
            productCacheRef.current.set(code, { product, ts: Date.now() });
            // Keep cache bounded
            if (productCacheRef.current.size > 100) {
              const oldest = productCacheRef.current.keys().next().value;
              productCacheRef.current.delete(oldest);
            }
          }
        }

        if (!product || !product.id) {
          playError();
          if (canAddProducts) {
            closeCameraRef.current?.(); // Stop scanning before opening QuickAdd
            setQuickAdd({ barcode: code });
          } else {
            showToast(t('product_not_found'), 'error');
          }
          return;
        }
        addToCart(product);
        playCartPop();
        hapticLight();
        showToast(`${product.name} ${t('product_added')}`, 'success');
      } catch (err) {
        playError();
        if (err.response?.status === 404) {
          if (canAddProducts) {
            closeCameraRef.current?.(); // Stop scanning before opening QuickAdd
            setQuickAdd({ barcode: code });
          } else {
            showToast(t('product_not_found'), 'error');
          }
        } else if (!navigator.onLine) {
          showToast(t('offline_cannot_lookup'), 'error');
        } else {
          showToast(t('lookup_failed'), 'error');
        }
      } finally {
        setLookupLoading(false);
        setManualCode('');
        setKbOpen(false);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        try { if (window.Capacitor?.isNativePlatform?.()) import('@capacitor/keyboard').then(m => m.Keyboard.hide()).catch(() => {}); } catch {}
      }
    },
    [addToCart, playError, showToast]
  );

  // useBarcode hook
  const {
    inputRef: barcodeInputRef,
    isScanning,
    isCameraOpen,
    openCamera,
    closeCamera,
    onCameraScan,
    handleManualSubmit,
  } = useBarcode({ onScan: lookupProduct });

  // Keep ref in sync so lookupProduct can close camera
  closeCameraRef.current = closeCamera;

  // Merge refs — barcode hook's inputRef is for HID; we also keep manualInputRef
  // We use manualInputRef for the visible text input

  // HID barcode scanner works at window level — no input focus needed

  // Load top products for quick-add
  useEffect(() => {
    async function loadTop() {
      try {
        const { data } = await api.get('/products/top?limit=3');
        if (Array.isArray(data) && data.length > 0) setTopProducts(data);
      } catch { /* ignore */ }
    }
    loadTop();
  }, []);

  // Fetch bank accounts when Bank, Transfer, or Split payment selected
  useEffect(() => {
    if (
      (currentPaymentMethod === 'bank' || currentPaymentMethod === 'transfer' || currentPaymentMethod === 'split') &&
      !banksLoaded &&
      isOnline
    ) {
      api
        .get('/accounts')
        .then(({ data }) => {
          setBankAccounts(data.accounts || data || []);
          setBanksLoaded(true);
        })
        .catch(() => {});
    }
  }, [currentPaymentMethod, banksLoaded, isOnline]);

  // Open product grid
  const openProductGrid = useCallback(async () => {
    setProductGridOpen(true);
    if (!productsLoaded) {
      try {
        const { data } = await api.get('/inventory');
        setAllProducts(data.products || data || []);
        setProductsLoaded(true);
      } catch (_) {
        showToast(t('could_not_load_products'), 'error');
      }
    }
  }, [productsLoaded, showToast]);

  const handleProductSelect = useCallback(
    (product) => {
      addToCart(product);
      playCartPop();
      hapticLight();
      showToast(`${product.name} added`, 'success');
      setProductGridOpen(false);
    },
    [addToCart, showToast]
  );

  // Handle manual barcode submit
  const onManualSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const code = manualCode.trim();
      if (!code) return;
      handleManualSubmit(code);
    },
    [manualCode, handleManualSubmit]
  );

  // Complete sale
  const completeSale = useCallback(async () => {
    if (cart.length === 0) {
      showToast(t('cart_empty'), 'error');
      return;
    }

    // Validate split amounts
    if (currentPaymentMethod === 'split') {
      const splitTotal =
        (Number(splitConfig.cashAmount) || 0) +
        (Number(splitConfig.bankAmount) || 0) +
        (Number(splitConfig.creditAmount) || 0);
      if (Math.abs(splitTotal - cartTotal) > 1) {
        showToast(t('split_amounts_must_equal'), 'error');
        return;
      }
    }

    if (currentPaymentMethod === 'credit' && !customerName.trim()) {
      showToast(t('enter_customer_name_credit'), 'error');
      return;
    }

    if (
      ((currentPaymentMethod === 'bank' || currentPaymentMethod === 'transfer') && !selectedBankId) ||
      (currentPaymentMethod === 'split' &&
        Number(splitConfig.bankAmount) > 0 &&
        !splitConfig.bankId)
    ) {
      showToast(t('select_bank_account'), 'error');
      return;
    }

    const salePayload = {
      items: cart.map((item) => ({
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        buyPrice: item.buyPrice,
      })),
      payments: [],
      customerName: (currentPaymentMethod === 'credit' || (currentPaymentMethod === 'split' && Number(splitConfig.creditAmount) > 0))
        ? (customerName.trim() || null)
        : null,
      discount: rageDiscount,
    };

    // Build payments array based on selected method
    if (currentPaymentMethod === 'cash') {
      salePayload.payments = [{ method: 'cash', amount: finalTotal }];
    } else if (currentPaymentMethod === 'bank') {
      salePayload.payments = [{ method: 'bank', amount: finalTotal, bankAccountId: selectedBankId }];
    } else if (currentPaymentMethod === 'transfer') {
      salePayload.payments = [{ method: 'bank', amount: finalTotal, bankAccountId: selectedBankId }];
    } else if (currentPaymentMethod === 'credit') {
      salePayload.payments = [{ method: 'credit', amount: finalTotal }];
    } else if (currentPaymentMethod === 'split') {
      if (Number(splitConfig.cashAmount) > 0) {
        salePayload.payments.push({ method: 'cash', amount: Number(splitConfig.cashAmount) });
      }
      if (Number(splitConfig.bankAmount) > 0) {
        salePayload.payments.push({ method: 'bank', amount: Number(splitConfig.bankAmount), bankAccountId: splitConfig.bankId });
      }
      if (Number(splitConfig.creditAmount) > 0) {
        salePayload.payments.push({ method: 'credit', amount: Number(splitConfig.creditAmount) });
      }
    }

    setSaleLoading(true);
    try {
      if (isOffline) {
        await enqueue({ method: 'post', url: '/sales', data: salePayload });
        playKaChing();
        hapticSuccess();
        speakSaleComplete(finalTotal);
        showToast(t('sale_queued_offline'), 'success');

        // Update sales streak
        try {
          const today = new Date().toISOString().split('T')[0];
          const stored = JSON.parse(localStorage.getItem('bizpos_streak') || '{}');
          if (stored.lastDate === today) {
            // Already recorded today
          } else {
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const newCount = stored.lastDate === yesterday ? (stored.count || 1) + 1 : 1;
            localStorage.setItem('bizpos_streak', JSON.stringify({ lastDate: today, count: newCount }));
          }
        } catch { /* ignore */ }

        // ESP32 SMS fallback: notify owner when offline
        const esp32Phone = localStorage.getItem('esp32_phone');
        if (esp32Phone && isESP32Connected()) {
          try {
            await sendSaleNotification(esp32Phone, {
              total: finalTotal,
              items: cart.map(i => ({ name: i.name, quantity: i.quantity })),
              paymentMethod: currentPaymentMethod,
              attendantName: user?.name || t('staff'),
              time: new Date().toLocaleTimeString(),
            });
          } catch (_) {
            // SMS send failed silently — sale is already queued
          }
        }
      } else {
        const { data } = await api.post('/sales', salePayload);
        playKaChing();
        hapticSuccess();
        speakSaleComplete(finalTotal);
        const saleProfit = data.profit ?? cartProfit;
        if (isOwner && saleProfit > 0) {
          setProfitToast({ visible: true, amount: saleProfit });
        }
        showToast(t('sale_complete'), 'success');

        // Update sales streak
        try {
          const today = new Date().toISOString().split('T')[0];
          const stored = JSON.parse(localStorage.getItem('bizpos_streak') || '{}');
          if (stored.lastDate === today) {
            // Already recorded today
          } else {
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const newCount = stored.lastDate === yesterday ? (stored.count || 1) + 1 : 1;
            localStorage.setItem('bizpos_streak', JSON.stringify({ lastDate: today, count: newCount }));
          }
        } catch { /* ignore */ }

        setCompletedSale({
          id: data.id || data.saleId,
          items: cart.map((i) => ({
            productName: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          total: finalTotal,
          discount: rageDiscount,
          payments: salePayload.payments,
          customerName: salePayload.customerName,
          attendantName: user?.name || t('staff'),
          createdAt: new Date().toISOString(),
        });
      }
      clearCart();
    } catch (err) {
      playError();
      const d = err.response?.data;
      const msg =
        (typeof d?.message === 'string' && d.message) ||
        (typeof d?.error === 'string' && d.error) ||
        d?.error?.message ||
        err.message ||
        t('sale_failed');
      showToast(msg, 'error');
    } finally {
      setSaleLoading(false);
      setKbOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      try { if (window.Capacitor?.isNativePlatform?.()) import('@capacitor/keyboard').then(m => m.Keyboard.hide()).catch(() => {}); } catch {}
    }
  }, [
    cart,
    cartTotal,
    cartProfit,
    currentPaymentMethod,
    selectedBankId,
    customerName,
    splitConfig,
    isOffline,
    isOwner,
    currency,
    clearCart,
    playError,
    showToast,
    speakSaleComplete,
  ]);

  const paymentMethods = useMemo(
    () => [
      { key: 'cash', label: t('cash'), icon: '\uD83D\uDCB5' },
      { key: 'bank', label: t('bank'), icon: '\uD83C\uDFE6' },
      { key: 'transfer', label: t('transfer'), icon: '\uD83D\uDCF1' },
      { key: 'credit', label: t('credit'), icon: '\uD83D\uDCB3' },
      { key: 'split', label: t('split'), icon: '\u2702\uFE0F' },
    ],
    [t]
  );

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-primary)] flex flex-col w-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[var(--bg-secondary)] border-b border-[var(--border)] px-3 py-2 flex items-center justify-between">
        <h1 className="text-base font-bold text-[var(--text-primary)] truncate">
          {businessName || t('app_name')}
        </h1>
        <button
          onClick={() => setMenuOpen((p) => !p)}
          className="w-9 h-9 flex items-center justify-center text-[var(--text-primary)] text-xl"
          aria-label={t('menu')}
        >
          &#9776;
        </button>
      </header>

      {/* Hamburger dropdown */}
      {menuOpen && (
        <div className="absolute top-12 right-2 z-40 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[160px]">
          <a href="/attendant/inventory" className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-gray-200">
            {t('inventory')}
          </a>
          <button
            onClick={() => { clearCart(); setMenuOpen(false); }}
            className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-200"
          >
            {t('empty_cart')}
          </button>
        </div>
      )}

      {/* ── Offline Banner ─────────────────────────────────────── */}
      {showBanner && (
        <div
          className={`px-3 py-1.5 text-center text-xs font-semibold ${
            isOffline
              ? 'bg-red-600 text-white'
              : 'bg-green-600 text-white'
          }`}
          onClick={dismissBanner}
        >
          {isOffline ? t('offline_queued') : t('online')}
        </div>
      )}

      {/* ── Toast (floating, no layout shift) ─────────────────── */}
      {toast && (
        <div
          className={`fixed top-14 left-3 right-3 z-50 px-3 py-2 rounded-lg text-sm font-medium text-center shadow-lg ${
            toast.type === 'error'
              ? 'bg-red-600/95 text-white'
              : 'bg-green-600/95 text-white'
          }`}
          style={{ animation: 'slideUp 0.2s ease-out' }}
          onClick={() => setToast(null)}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Scanner Section ────────────────────────────────────── */}
      <section className="px-3 pt-3 pb-2 space-y-2">
        {/* Camera overlay — lazy loaded to save ~150KB */}
        {isCameraOpen && (
          <Suspense fallback={<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" /></div>}>
            <BarcodeScanner
              isOpen={isCameraOpen}
              onScan={(code) => { onCameraScan(code); }}
              onClose={closeCamera}
            />
          </Suspense>
        )}

        {/* Manual / HID input */}
        <form onSubmit={onManualSubmit} className="relative">
          <input
            ref={manualInputRef}
            type="text"
            inputMode="numeric"
            readOnly={!kbOpen}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onClick={() => { if (!kbOpen) { setKbOpen(true); setTimeout(() => manualInputRef.current?.focus(), 30); } }}
            placeholder={t('type_or_scan')}
            className={`w-full h-11 pl-3 pr-16 rounded-lg border bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${kbOpen ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}
          />
          <button
            type="submit"
            disabled={lookupLoading || !manualCode.trim()}
            className="absolute right-1 top-1 h-9 px-3 rounded-md bg-[var(--accent)] text-white font-bold text-sm disabled:opacity-40"
          >
            {lookupLoading ? '...' : t('add')}
          </button>
        </form>

        {/* Browse products button */}
        <button
          onClick={openProductGrid}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--text-secondary)] text-sm font-semibold active:scale-[0.97] transition-transform"
        >
          {t('browse_products')}
        </button>

        {isScanning && (
          <p className="text-xs text-[var(--text-secondary)] text-center animate-pulse">
            {t('scanning_active')}
          </p>
        )}
      </section>

      {/* ── Floating SCAN FAB — bottom-right, hidden when cart has items ── */}
      {!isCameraOpen && !completedSale && cart.length === 0 && (
        <button
          onClick={openCamera}
          className="fixed z-40 w-14 h-14 rounded-full bg-[var(--accent)] text-white shadow-xl flex items-center justify-center active:scale-90 transition-transform"
          style={{
            right: 16,
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)',
          }}
          aria-label={t('scan')}
        >
          <span className="text-xl">{'\uD83D\uDCF7'}</span>
        </button>
      )}

      {/* ── Quick-add favorites ──────────────────────────────── */}
      {topProducts.length > 0 && (
        <div className="flex gap-2 px-3 py-1.5 overflow-x-auto">
          {topProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                addToCart(p);
                playCartPop();
                hapticLight();
              }}
              className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
            >
              {(p.name || '').slice(0, 8)} {currency}{(p.sellPrice || p.sell_price || 0).toLocaleString()}
            </button>
          ))}
        </div>
      )}

      {/* ── Cart Section ───────────────────────────────────────── */}
      <section className="flex-1 overflow-y-auto px-0 hide-scrollbar">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
            <p className="text-4xl mb-2">{'\uD83D\uDED2'}</p>
            <p className="text-sm">{t('scan_items_to_start')}</p>
          </div>
        ) : (
          <div className="pb-44">
            {cart.map((item) => (
              <CartItem
                key={item.productId}
                item={item}
                currency={currency}
                onRemove={removeFromCart}
                onUpdateQty={updateQuantity}
                t={t}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Bottom Panel (fixed above nav) ─────────────────────── */}
      {cart.length > 0 && (
        <section className="fixed left-0 right-0 bg-[var(--bg-secondary)] border-t border-[var(--border)] z-30 flex flex-col max-h-[50vh]" style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
          {/* Payment methods — scrollable area */}
          <div className="px-3 pt-2 overflow-y-auto flex-1 min-h-0">
            <div className="flex gap-1.5 overflow-x-auto pb-2 hide-scrollbar">
            {paymentMethods.map((pm) => (
              <button
                key={pm.key}
                onClick={() => setPaymentMethod(pm.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  currentPaymentMethod === pm.key
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-color)]'
                }`}
              >
                {pm.icon} {pm.label}
              </button>
            ))}
          </div>
          {currentPaymentMethod === 'split' && (
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 px-1">{t('split_hint')}</p>
          )}

          {/* Bank account selector (shown for Bank & Transfer) */}
          {(currentPaymentMethod === 'bank' || currentPaymentMethod === 'transfer') && (
            <div className="mt-2">
              <select
                value={selectedBankId || ''}
                onChange={(e) => {
                  if (e.target.value === '__add__') { setAddingBank(true); return; }
                  setSelectedBankId(e.target.value || null);
                }}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm"
              >
                <option value="">{t('select_bank_account')}</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} — {b.accountNumber || b.name}
                  </option>
                ))}
                <option value="__add__">+ {t('add_bank')}</option>
              </select>
              {addingBank && (
                <div className="space-y-1 mt-1">
                  <div className="flex gap-2">
                    <input value={newBankName} onChange={(e) => setNewBankName(e.target.value)}
                      placeholder={t('bank_name')} autoFocus
                      className="flex-1 h-9 px-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm" />
                    <input value={newBankAcct} onChange={(e) => setNewBankAcct(e.target.value)}
                      placeholder={t('account_number')}
                      className="flex-1 h-9 px-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <input type="number" inputMode="numeric" value={newBankBal} onChange={(e) => setNewBankBal(e.target.value)}
                      placeholder={t('initial_balance')}
                      className="flex-1 h-9 px-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm" />
                    <button onClick={() => handleAddBank((id) => setSelectedBankId(id))} disabled={bankSaving}
                      className="h-9 px-3 rounded bg-green-600 text-white text-sm font-bold disabled:opacity-50">
                      {bankSaving ? '...' : t('save')}
                    </button>
                    <button onClick={() => setAddingBank(false)} className="h-9 px-2 text-[var(--text-secondary)] text-sm">&times;</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Credit: customer name */}
          {currentPaymentMethod === 'credit' && (
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('customer_name')}
              className="mt-2 w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)]"
            />
          )}

          {/* Split payment config */}
          {currentPaymentMethod === 'split' && (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-[var(--text-secondary)] uppercase">{t('cash')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={splitConfig.cashAmount || ''}
                    onChange={(e) =>
                      setSplitConfig({ ...splitConfig, cashAmount: Number(e.target.value) || 0 })
                    }
                    placeholder="0"
                    className="w-full h-9 px-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-[var(--text-secondary)] uppercase">{t('bank')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={splitConfig.bankAmount || ''}
                    onChange={(e) =>
                      setSplitConfig({ ...splitConfig, bankAmount: Number(e.target.value) || 0 })
                    }
                    placeholder="0"
                    className="w-full h-9 px-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-[var(--text-secondary)] uppercase">{t('credit')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={splitConfig.creditAmount || ''}
                    onChange={(e) =>
                      setSplitConfig({ ...splitConfig, creditAmount: Number(e.target.value) || 0 })
                    }
                    placeholder="0"
                    className="w-full h-9 px-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
              </div>
              {Number(splitConfig.bankAmount) > 0 && (
                <>
                  <select
                    value={splitConfig.bankId || ''}
                    onChange={(e) => {
                      if (e.target.value === '__add__') { setAddingBank(true); return; }
                      setSplitConfig({ ...splitConfig, bankId: e.target.value || null });
                    }}
                    className="w-full h-9 px-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm"
                  >
                    <option value="">{t('select_bank')}</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} — {b.accountNumber || b.name}
                      </option>
                    ))}
                    <option value="__add__">+ {t('add_bank')}</option>
                  </select>
                  {addingBank && (
                    <div className="space-y-1 mt-1">
                      <div className="flex gap-2">
                        <input value={newBankName} onChange={(e) => setNewBankName(e.target.value)}
                          placeholder={t('bank_name')} autoFocus
                          className="flex-1 h-9 px-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm" />
                        <input value={newBankAcct} onChange={(e) => setNewBankAcct(e.target.value)}
                          placeholder={t('account_number')}
                          className="flex-1 h-9 px-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm" />
                      </div>
                      <div className="flex gap-2">
                        <input type="number" inputMode="numeric" value={newBankBal} onChange={(e) => setNewBankBal(e.target.value)}
                          placeholder={t('initial_balance')}
                          className="flex-1 h-9 px-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm" />
                        <button onClick={() => handleAddBank((id) => setSplitConfig((c) => ({ ...c, bankId: id })))} disabled={bankSaving}
                          className="h-9 px-3 rounded bg-green-600 text-white text-sm font-bold disabled:opacity-50">
                          {bankSaving ? '...' : t('save')}
                        </button>
                        <button onClick={() => setAddingBank(false)} className="h-9 px-2 text-[var(--text-secondary)] text-sm">&times;</button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {Number(splitConfig.creditAmount) > 0 && (
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t('customer_name_credit_portion')}
                  className="w-full h-9 px-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)]"
                />
              )}
            </div>
          )}

            {/* Spacer so last inputs are scrollable into view */}
            <div className="h-2" />
          </div>

          {/* Total + Complete sale — pinned at bottom, never hidden */}
          <div className="px-3 py-2 border-t border-[var(--border)] flex-shrink-0">
            {/* Info row: items count, total, rage */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  {cart.length} {cart.length === 1 ? t('item') : t('items')}
                </span>
                <button
                  onClick={handleRage}
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-orange-400 text-orange-600 transition-colors"
                >
                  {t('rage')} ↓
                </button>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-[var(--text-primary)]">
                  {currency}{finalTotal.toLocaleString()}
                </span>
                {rageDiscount > 0 && (
                  <span className="text-[9px] text-orange-600 ml-1">-{currency}{rageDiscount.toLocaleString()}</span>
                )}
              </div>
            </div>
            {/* Full-width Complete Sale button */}
            <button
              onClick={completeSale}
              disabled={saleLoading || cart.length === 0}
              className="w-full h-11 rounded-xl bg-green-600 active:bg-green-700 text-white text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
            >
              {saleLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {'\u2705'} {t('complete_sale').toUpperCase()}
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* Hidden input for HID scanner */}
      <input
        ref={barcodeInputRef}
        type="text"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Close menu on backdrop tap */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Product Grid overlay */}
      <ProductGrid
        products={allProducts}
        onSelect={handleProductSelect}
        isOpen={productGridOpen}
        onClose={() => setProductGridOpen(false)}
      />

      {/* Receipt overlay */}
      {completedSale && (
        <Receipt
          sale={completedSale}
          businessName={businessName}
          businessType=""
          currency={currency}
          onClose={() => { setCompletedSale(null); setKbOpen(false); }}
          onPrint={() => window.print()}
        />
      )}

      {/* Profit toast (owner only) */}
      <ProfitToast
        profit={profitToast.amount}
        isVisible={profitToast.visible}
        onDismiss={() => setProfitToast({ visible: false, amount: 0 })}
        currency={currency}
      />

      {/* Quick-add: scanned barcode not in system */}
      {quickAdd && (
        <QuickAddModal
          barcode={quickAdd.barcode}
          t={t}
          onClose={() => setQuickAdd(null)}
          onSaved={(product) => {
            setQuickAdd(null);
            addToCart(product);
            playCartPop();
            hapticSuccess();
            showToast(`${product.name} ${t('product_added')}`, 'success');
          }}
        />
      )}

    </div>
  );
}
