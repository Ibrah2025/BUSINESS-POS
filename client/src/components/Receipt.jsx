import { useRef, useEffect, useState } from 'react';
import { useTranslation } from '../i18n';

export default function Receipt({ sale, businessName, businessType, onClose, onPrint, currency = '\u20A6' }) {
  const { t } = useTranslation();
  const receiptRef = useRef(null);
  const [keyboardUp, setKeyboardUp] = useState(false);

  // Dismiss keyboard when receipt appears + listen for keyboard show/hide
  useEffect(() => {
    // Blur active element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Force-hide keyboard on native
    try {
      if (window.Capacitor?.isNativePlatform?.()) {
        import('@capacitor/keyboard').then(m => m.Keyboard.hide()).catch(() => {});
      }
    } catch {}

    // Detect keyboard via visualViewport resize
    const vv = window.visualViewport;
    if (vv) {
      const onResize = () => {
        // If viewport height shrinks significantly, keyboard is open
        setKeyboardUp(vv.height < window.innerHeight * 0.75);
      };
      vv.addEventListener('resize', onResize);
      onResize();
      return () => vv.removeEventListener('resize', onResize);
    }
  }, []);

  if (!sale) return null;

  const receiptNo = sale.id
    ? `RCP-${String(sale.id).slice(0, 8).toUpperCase()}`
    : `RCP-${Date.now().toString(36).toUpperCase()}`;

  const date = sale.createdAt
    ? new Date(sale.createdAt).toLocaleString()
    : new Date().toLocaleString();

  const items = sale.items || [];
  const subtotal = items.reduce(
    (s, i) => s + (i.unitPrice || 0) * (i.quantity || 1),
    0
  );
  const discount = sale.discount || 0;
  const total = sale.total ?? subtotal - discount;

  const paymentLabel =
    sale.payments?.map((p) => p.method).join(' + ') || t('cash');

  const handlePrint = () => {
    if (onPrint) return onPrint();
    window.print();
  };

  const handleShare = async () => {
    if (!navigator.share) return;
    const itemLines = items.map((i) => {
      const name = (i.productName || i.name || '').slice(0, 20);
      const qty = i.quantity || 1;
      const amt = (i.unitPrice || 0) * qty;
      return `${name} x${qty}  ${currency}${amt.toLocaleString()}`;
    }).join('\n');
    const text = `=== ${businessName || t('business_name')} ===
${date}
${sale.attendantName ? `${t('cashier')} ${sale.attendantName}\n` : ''}---
${itemLines}
---
${t('total')}: ${currency}${total.toLocaleString()}${discount ? `\n${t('discount')}: ${currency}${discount.toLocaleString()}` : ''}
${t('payment')}: ${paymentLabel}
${receiptNo}
${t('thank_you_patronage')}`;
    try {
      await navigator.share({ title: `Receipt ${receiptNo}`, text });
    } catch (_) {}
  };

  return (
    <div className={`fixed inset-0 z-50 flex ${keyboardUp ? 'items-start pt-6' : 'items-center'} justify-center bg-black/60 p-4`}
      style={{ paddingBottom: keyboardUp ? 0 : 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
      <div className={`w-full max-w-sm bg-white rounded-xl overflow-hidden flex flex-col ${keyboardUp ? 'max-h-[55vh]' : 'max-h-[80vh]'}`}>
        {/* Receipt body */}
        <div ref={receiptRef} className="p-4 overflow-y-auto flex-1 print-receipt">
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
            <p className="font-bold text-base text-gray-900">{businessName || t('business_name')}</p>
            {businessType && <p className="text-xs text-gray-500">{businessType}</p>}
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-600 space-y-0.5 mb-3">
            <p>{t('date')} {date}</p>
            <p>{t('cashier')} {sale.attendantName || t('staff')}</p>
            <p className="text-[10px] text-gray-400">{receiptNo}</p>
          </div>

          {/* Items table */}
          <div className="border-t border-dashed border-gray-300 pt-2 mb-2">
            <div className="flex text-[10px] text-gray-500 uppercase tracking-wide mb-1">
              <span className="flex-1">{t('item')}</span>
              <span className="w-8 text-center">{t('qty')}</span>
              <span className="w-20 text-right">{t('amount')}</span>
            </div>
            {items.map((item, idx) => {
              const name = item.productName || item.name || '';
              const qty = item.quantity || 1;
              const amt = (item.unitPrice || 0) * qty;
              return (
                <div key={idx} className="flex text-sm text-gray-800 py-0.5">
                  <span className="flex-1 truncate">{name}</span>
                  <span className="w-8 text-center text-gray-600">{qty}</span>
                  <span className="w-20 text-right font-medium">{currency}{amt.toLocaleString()}</span>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-gray-300 pt-2 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{t('subtotal')}</span>
              <span>{currency}{subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>{t('discount')}</span>
                <span>-{currency}{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200">
              <span>{t('total')}</span>
              <span>{currency}{total.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment & customer */}
          <div className="border-t border-dashed border-gray-300 mt-3 pt-2 text-xs text-gray-600 space-y-0.5">
            <p>{t('payment')}: {paymentLabel}</p>
            {sale.customerName && <p>{t('customer')}: {sale.customerName}</p>}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-4">{t('thank_you_patronage')}</p>
        </div>

        {/* Action buttons — always visible at bottom */}
        <div className="flex gap-2 p-3 border-t border-gray-100 print:hidden bg-white shrink-0">
          <button
            onClick={handlePrint}
            className="flex-1 h-11 rounded-lg bg-blue-600 active:bg-blue-700 text-white font-bold text-sm"
          >
            {t('print_receipt')}
          </button>
          {navigator.share && (
            <button
              onClick={handleShare}
              className="h-11 px-4 rounded-lg bg-gray-100 active:bg-gray-200 text-gray-800 font-bold text-sm"
            >
              {t('share')}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-lg bg-green-600 active:bg-green-700 text-white font-bold text-sm"
          >
            {t('done')}
          </button>
        </div>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-receipt, .print-receipt * { visibility: visible !important; }
          .print-receipt { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
