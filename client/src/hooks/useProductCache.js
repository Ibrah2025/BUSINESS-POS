import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const DB_NAME = 'bizpos-product-cache';
const STORE_NAME = 'products';
const META_KEY = 'cache-meta';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllCached() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function cacheProducts(products) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    products.forEach((p) => store.put(p));
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Caches full product catalog in IndexedDB for offline barcode lookup.
 * Syncs on mount if online, serves from cache if offline.
 */
export function useProductCache() {
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Load from cache first, then sync from server
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Step 1: Load from IndexedDB cache immediately
      const cached = await getAllCached();
      if (!cancelled && cached.length > 0) {
        setProducts(cached);
        setLoaded(true);
      }

      // Step 2: Try to sync from server if online
      if (navigator.onLine) {
        try {
          const { data } = await api.get('/products?limit=5000');
          const list = Array.isArray(data) ? data : data?.products || [];
          if (!cancelled && list.length > 0) {
            setProducts(list);
            setLoaded(true);
            await cacheProducts(list);
            localStorage.setItem(META_KEY, new Date().toISOString());
          }
        } catch {
          // Server failed — cached data is still valid
        }
      }

      if (!cancelled) setLoaded(true);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Lookup by barcode from cached products
  const findByBarcode = useCallback(
    (barcode) => {
      if (!barcode) return null;
      return products.find((p) => p.barcode === barcode) || null;
    },
    [products]
  );

  // Search by name from cached products
  const searchByName = useCallback(
    (query) => {
      if (!query || query.length < 2) return [];
      const q = query.toLowerCase();
      return products.filter((p) =>
        (p.name || '').toLowerCase().includes(q)
      ).slice(0, 20);
    },
    [products]
  );

  return { products, loaded, findByBarcode, searchByName };
}
