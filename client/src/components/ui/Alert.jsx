import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const typeStyles = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-yellow-500 text-white',
  info: 'bg-blue-600 text-white',
};

function Alert({ message, type = 'info', onDismiss }) {
  useEffect(() => {
    // auto-dismiss handled by provider
  }, []);

  return (
    <div
      className={`
        px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium
        animate-[slideDown_0.25s_ease-out]
        ${typeStyles[type] || typeStyles.info}
      `}
    >
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="opacity-70 hover:opacity-100 shrink-0">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

const AlertContext = createContext(null);

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
}

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const idRef = useRef(0);

  const showAlert = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++idRef.current;
    setAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }, duration);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {/* Alert container */}
      <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {alerts.map(a => (
          <div key={a.id} className="pointer-events-auto">
            <Alert message={a.message} type={a.type} onDismiss={() => dismiss(a.id)} />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </AlertContext.Provider>
  );
}

export default Alert;
