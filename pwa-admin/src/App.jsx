import { useEffect, useMemo, useState } from 'react';
import AdminApp from './admin/AdminApp.jsx';
import AdminLogin from './admin/AdminLogin.jsx';
import {
  BUILD_DATA_MODE,
  DATA_MODES,
  createApiDataSource,
  createMockDataSource,
} from './admin/services/adminDataSource.js';
import { ADMIN_SESSION_EXPIRED_EVENT, clearSession, getSession } from './admin/services/adminSession.js';

/**
 * API builds (VITE_DATA_MODE=api) require a real ADMIN sign-in. Mock builds also offer
 * "Continue with demo data"; signing in there still uses the real API.
 */
export default function App({ buildMode = BUILD_DATA_MODE, login } = {}) {
  // Demo entry exists only in mock builds; Vite inlines VITE_DATA_MODE so api builds drop it.
  const allowDemo = import.meta.env.VITE_DATA_MODE !== 'api' && buildMode === DATA_MODES.MOCK;
  const [session, setSession] = useState(() => getSession());
  const [demo, setDemo] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const onExpired = () => {
      setSession(null);
      setDemo(false);
      setExpired(true);
    };
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const token = session?.accessToken ?? null;
  const dataSource = useMemo(() => {
    if (token) return createApiDataSource();
    if (import.meta.env.VITE_DATA_MODE !== 'api' && allowDemo && demo) return createMockDataSource();
    return null;
  }, [token, demo, allowDemo]);

  if (!dataSource) {
    return (
      <AdminLogin
        allowDemo={allowDemo}
        expired={expired}
        login={login}
        onDemo={() => setDemo(true)}
        onAuthenticated={(next) => {
          setExpired(false);
          setDemo(false);
          setSession(next);
        }}
      />
    );
  }

  return (
    <AdminApp
      key={token ?? 'demo'}
      dataSource={dataSource}
      session={session}
      onLogout={() => {
        clearSession();
        setSession(null);
        setDemo(false);
      }}
    />
  );
}
