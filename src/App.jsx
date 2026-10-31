import React, { useState, useEffect } from 'react';
import { AdminDashboardPage } from './pages/AdminDashboardPage.jsx';
import { StudentQuizPage } from './pages/StudentQuizPage.jsx';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    try {
      window.__lastReactError = { error, errorInfo };
    } catch (_) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
            padding: 20,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: 500,
              width: '100%',
              background: '#ffffff',
              borderRadius: 16,
              padding: '32px 24px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
              border: '1.5px solid #e2e8f0',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>⚠️</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
              Terjadi Kesalahan Tampilan
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Aplikasi mendeteksi error pada saat memuat antarmuka. Anda dapat mereset sesi atau memuat ulang halaman.
            </p>
            <div
              style={{
                background: '#fef2f2',
                color: '#991b1b',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                textAlign: 'left',
                marginBottom: 20,
                wordBreak: 'break-all',
                maxHeight: 120,
                overflowY: 'auto',
              }}
            >
              {String(this.state.error?.message || this.state.error || 'Terjadi kesalahan tidak dikenal')}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  background: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                🔄 Muat Ulang
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch (_) {}
                  window.location.reload();
                }}
                style={{
                  background: '#ffffff',
                  color: '#dc2626',
                  border: '1.5px solid #fca5a5',
                  padding: '9px 18px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                🧹 Reset Sesi
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return (
    <ErrorBoundary>
      {pathname.startsWith('/quiz') ? <StudentQuizPage /> : <AdminDashboardPage />}
    </ErrorBoundary>
  );
}

