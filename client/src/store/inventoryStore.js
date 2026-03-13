import { create } from 'zustand';

export const useInventoryStore = create((set, get) => ({
  products: [],
  categories: [],
  isLoading: false,
  searchQuery: '',
  selectedCategory: null,

  setProducts: (products) => {
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
    set({ products, categories });
  },

  addProduct: (product) =>
    set((state) => {
      const categories = product.category && !state.categories.includes(product.category)
        ? [...state.categories, product.category]
        : state.categories;
      return { products: [...state.products, product], categories };
    }),

  updateProduct: (id, data) =>
    set((state) => ({
      products: state.products.map((p) => (p.id === id ? { ...p, ...data } : p)),
    })),

  removeProduct: (id) =>
    set((state) => ({
      products: state.products.filter((p) => p.id !== id),
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setCategory: (cat) => set({ selectedCategory: cat }),

  get filteredProducts() {
    const { products, searchQuery, selectedCategory } = get();
    return products.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery));
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  },
}));
