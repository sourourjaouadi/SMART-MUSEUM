import { useEffect, useState } from 'react';
import ClientLogin from './components/ClientLogin.jsx';
import ConservationDashboard from './pages/ConservationDashboard.jsx';
import { DEFAULT_DATA_MODE, DATA_MODES } from './services/dataSource.js';
import {
  clearSession,
  getSession,
  SESSION_EXPIRED_EVENT,
} from './services/authSession.js';

export default function App() {
  const [session, setSession] = useState(() => getSession());
  const [dashboardMode, setDashboardMode] = useState(() =>
    DEFAULT_DATA_MODE === DATA_MODES.API || getSession()
      ? DATA_MODES.API
      : DATA_MODES.MOCK,
  );
  const [showLogin, setShowLogin] = useState(() =>
    DEFAULT_DATA_MODE === DATA_MODES.API && !getSession(),
  );
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (DEFAULT_DATA_MODE !== DATA_MODES.API || session) return undefined;
    const timer = window.setTimeout(() => setShowLogin(true), 0);
    return () => window.clearTimeout(timer);
  }, [session]);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession();
      setSession(null);
      setDashboardMode(DATA_MODES.API);
      setSessionExpired(true);
      setShowLogin(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  useEffect(() => {
    if (!session?.expiresAt) return undefined;
    const timeout = window.setTimeout(() => {
      clearSession({ expired: true });
    }, Math.max(0, session.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [session]);

  if (showLogin) {
    return (
      <ClientLogin
        expired={sessionExpired}
        onAuthenticated={(nextSession) => {
          setSession(nextSession);
          setDashboardMode(DATA_MODES.API);
          setSessionExpired(false);
          setShowLogin(false);
        }}
        onDemo={() => {
          clearSession();
          setSession(null);
          setDashboardMode(DATA_MODES.MOCK);
          setSessionExpired(false);
          setShowLogin(false);
        }}
      />
    );
  }

  return (
    <ConservationDashboard
      initialMode={dashboardMode}
      session={session}
      onLoginRequested={() => {
        setDashboardMode(DATA_MODES.API);
        setSessionExpired(false);
        setShowLogin(true);
      }}
      onLogout={() => {
        clearSession();
        setSession(null);
        if (DEFAULT_DATA_MODE === DATA_MODES.API) {
          setDashboardMode(DATA_MODES.MOCK);
          setShowLogin(true);
          return;
        }
        setDashboardMode(DATA_MODES.MOCK);
      }}
    />
  );
}
