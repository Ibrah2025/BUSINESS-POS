import React, { Component, Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import BottomNav from './components/BottomNav';

// Error boundary — prevents blank screen on React crashes
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #333)' }}>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</p>
          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16, maxWidth: 300, wordBreak: 'break-word' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ padding: '10px 24px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15 }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy-loaded pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const ScanSell = lazy(() => import('./pages/attendant/ScanSell'));
const QuickInventory = lazy(() => import('./pages/attendant/QuickInventory'));
const Dashboard = lazy(() => import('./pages/owner/Dashboard'));
const Inventory = lazy(() => import('./pages/owner/Inventory'));
const Transactions = lazy(() => import('./pages/owner/Transactions'));
const Credits = lazy(() => import('./pages/owner/Credits'));
const Expenses = lazy(() => import('./pages/owner/Expenses'));
const Accounts = lazy(() => import('./pages/owner/Accounts'));
const CashRegister = lazy(() => import('./pages/owner/CashRegister'));
const Returns = lazy(() => import('./pages/owner/Returns'));
const Customers = lazy(() => import('./pages/owner/Customers'));
const Reports = lazy(() => import('./pages/owner/Reports'));
const Staff = lazy(() => import('./pages/owner/Staff'));
const Settings = lazy(() => import('./pages/owner/Settings'));
const NotFound = lazy(() => import('./pages/shared/NotFound'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-[var(--bg-primary,#fff)]">
      <div className="animate-spin w-8 h-8 border-4 border-[var(--accent,#16a34a)] border-t-transparent rounded-full" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const token = useAuthStore((state) => state.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppContent() {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const theme = useSettingsStore((state) => state.theme);
  const hideNav = ['/login', '/onboarding', '/'].includes(location.pathname);
  const showNav = token && !hideNav;

  // Ensure theme is always applied to the DOM
  useEffect(() => {
    document.documentElement.dataset.theme = theme || 'premium';
  }, [theme]);

  return (
    <>
      <Suspense fallback={<LoadingFallback />}>
        <div className={showNav ? 'pb-[52px]' : ''}>
        <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Attendant */}
        <Route path="/scan" element={<ProtectedRoute><ScanSell /></ProtectedRoute>} />
        <Route path="/attendant/inventory" element={<ProtectedRoute><QuickInventory /></ProtectedRoute>} />

        {/* Owner */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
        <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
        <Route path="/cash" element={<ProtectedRoute><CashRegister /></ProtectedRoute>} />
        <Route path="/returns" element={<ProtectedRoute><Returns /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
        </div>
    </Suspense>
    {showNav && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
