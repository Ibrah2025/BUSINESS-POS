import { create } from 'zustand';

export const useSalesStore = create((set, get) => ({
  cart: [],
  // cart items: { productId, barcode, name, quantity, unitPrice, buyPrice, profit }
  pendingItems: [],
  currentPaymentMethod: 'cash', // 'cash' | 'bank' | 'credit' | 'split'
  selectedBankId: null,
  customerName: '',
  splitConfig: { cashAmount: 0, bankAmount: 0, creditAmount: 0, bankId: null },
  discount: 0,

  addToCart: (product) =>
    set((state) => {
      const existing = state.cart.findIndex((item) => item.productId === product.id);
      if (existing !== -1) {
        const updated = [...state.cart];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + 1,
        };
        return { cart: updated };
      }
      const unitPrice = product.unitPrice || product.sellingPrice || 0;
      const buyPrice = product.buyPrice || product.costPrice || 0;
      return {
        cart: [
          ...state.cart,
          {
            productId: product.id,
            barcode: product.barcode || '',
            name: product.name,
            quantity: 1,
            unitPrice,
            buyPrice,
            profit: unitPrice - buyPrice,
          },
        ],
      };
    }),

  removeFromCart: (productId) =>
    set((state) => ({
      cart: state.cart.filter((item) => item.productId !== productId),
    })),

  updateQuantity: (productId, qty) => {
    if (qty < 1) return;
    set((state) => ({
      cart: state.cart.map((item) =>
        item.productId === productId ? { ...item, quantity: qty } : item
      ),
    }));
  },

  clearCart: () =>
    set({
      cart: [],
      pendingItems: [],
      currentPaymentMethod: 'cash',
      selectedBankId: null,
      customerName: '',
      splitConfig: { cashAmount: 0, bankAmount: 0, creditAmount: 0, bankId: null },
      discount: 0,
    }),

  setPaymentMethod: (method) => set({ currentPaymentMethod: method }),
  setSplitConfig: (config) => set({ splitConfig: config }),
  setSelectedBankId: (bankId) => set({ selectedBankId: bankId }),
  setDiscount: (amount) => set({ discount: amount }),
  setCustomerName: (name) => set({ customerName: name }),

  get cartTotal() {
    const { cart, discount } = get();
    const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    return Math.max(0, subtotal - discount);
  },

  get cartProfit() {
    const { cart, discount } = get();
    const totalProfit = cart.reduce((sum, item) => sum + item.profit * item.quantity, 0);
    return Math.max(0, totalProfit - discount);
  },
}));
