const REQUIRED_FIELDS = ['products', 'sales', 'exportedAt'];

export function validateBackupData(data) {
  if (!data || typeof data !== 'object') return false;
  return REQUIRED_FIELDS.every((f) => f in data);
}

export function exportBackup(state) {
  const payload = {
    ...state,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `pos-backup-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!validateBackupData(data)) {
          reject(new Error('Invalid backup file: missing required fields'));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
