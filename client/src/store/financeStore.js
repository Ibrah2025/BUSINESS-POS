import { create } from 'zustand';

export const useFinanceStore = create((set, get) => ({
  physicalCash: 0,
  bankAccounts: [],
  customerCredits: [],
  supplierCredits: [],
  expenses: [],
  cashTransactions: [],

  setFinancialData: (data) =>
    set({
      physicalCash: data.physicalCash ?? 0,
      bankAccounts: data.bankAccounts ?? [],
      customerCredits: data.customerCredits ?? [],
      supplierCredits: data.supplierCredits ?? [],
      expenses: data.expenses ?? [],
      cashTransactions: data.cashTransactions ?? [],
    }),

  updateCash: (amount) =>
    set((state) => ({ physicalCash: state.physicalCash + amount })),

  addExpense: (expense) =>
    set((state) => ({ expenses: [...state.expenses, expense] })),

  addCredit: (credit) =>
    set((state) => {
      if (credit.type === 'supplier') {
        return { supplierCredits: [...state.supplierCredits, credit] };
      }
      return { customerCredits: [...state.customerCredits, credit] };
    }),

  updateCredit: (id, data) =>
    set((state) => ({
      customerCredits: state.customerCredits.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
      supplierCredits: state.supplierCredits.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    })),
}));
