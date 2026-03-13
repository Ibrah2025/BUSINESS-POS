import api from './client';

const DB_NAME = 'pos-offline-queue';
const STORE_NAME = 'requests';
const MAX_QUEUE = 500;

let db = null;

function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

// localStorage fallback
const LS_KEY = 'pos_offline_queue';

function lsGet() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function lsSet(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

let useLS = false;

async function init() {
  try {
    await openDB();
  } catch {
    useLS = true;
  }
}

init();

// Process queue when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processQueue();
  });
}

export async function enqueue(request) {
  const entry = {
    method: request.method,
    url: request.url,
    data: request.data,
    timestamp: Date.now(),
  };

  if (useLS) {
    const q = lsGet();
    if (q.length >= MAX_QUEUE) return;
    q.push(entry);
    lsSet(q);
    return;
  }

  const d = await openDB();
  const tx = d.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const count = await new Promise((r) => {
    const req = store.count();
    req.onsuccess = () => r(req.result);
  });
  if (count >= MAX_QUEUE) return;
  store.add(entry);
}

export async function dequeue() {
  if (useLS) {
    const q = lsGet();
    if (!q.length) return null;
    const item = q.shift();
    lsSet(q);
    return item;
  }

  const d = await openDB();
  const tx = d.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const items = await new Promise((r) => {
    const req = store.getAll();
    req.onsuccess = () => r(req.result);
  });
  if (!items.length) return null;
  const first = items[0];
  store.delete(first.id);
  return first;
}

export async function processQueue() {
  if (useLS) {
    const q = lsGet();
    if (!q.length) return;
    const remaining = [];
    for (const req of q) {
      try {
        await api({ method: req.method, url: req.url, data: req.data });
      } catch {
        remaining.push(req);
      }
    }
    lsSet(remaining);
    return;
  }

  const d = await openDB();
  const tx = d.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const items = await new Promise((r) => {
    const req = store.getAll();
    req.onsuccess = () => r(req.result);
  });

  for (const item of items) {
    try {
      await api({ method: item.method, url: item.url, data: item.data });
      const delTx = d.transaction(STORE_NAME, 'readwrite');
      delTx.objectStore(STORE_NAME).delete(item.id);
    } catch {
      break; // stop on first failure to preserve order
    }
  }
}

export async function getQueueSize() {
  if (useLS) return lsGet().length;
  const d = await openDB();
  const tx = d.transaction(STORE_NAME, 'readonly');
  return new Promise((r) => {
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => r(req.result);
  });
}

// Keep backward compat alias
export { getQueueSize as queueSize };
