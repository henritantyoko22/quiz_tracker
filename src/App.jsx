import React, { useState, useEffect } from 'react';
import { AdminDashboardPage } from './pages/AdminDashboardPage.jsx';
import { StudentQuizPage } from './pages/StudentQuizPage.jsx';

export function App() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (pathname.startsWith('/quiz')) {
    return <StudentQuizPage />;
  }

  return <AdminDashboardPage />;
}

