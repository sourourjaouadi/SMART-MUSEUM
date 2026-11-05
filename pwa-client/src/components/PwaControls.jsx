import { useEffect, useState } from 'react';

export default function PwaControls() {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  );
  const [installPrompt, setInstallPrompt] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => setInstallPrompt(null);
    const handleUpdateAvailable = () => setUpdateAvailable(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('smart-museum:update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener(
        'smart-museum:update-available',
        handleUpdateAvailable,
      );
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) {
      return;
    }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch (error) {
      console.error('Smart Museum installation prompt failed.', error);
    } finally {
      setInstallPrompt(null);
    }
  };

  return (
    <>
      <div className="pwa-controls" aria-label="Application status and actions">
        <span
          className={`pwa-connectivity pwa-connectivity--${isOnline ? 'online' : 'offline'}`}
          role="status"
          aria-live="polite"
        >
          <span className="connection-status__dot" aria-hidden="true" />
          {isOnline ? 'Browser online' : 'Browser offline'}
        </span>
        {installPrompt && (
          <button className="pwa-action" type="button" onClick={installApp}>
            Install app
          </button>
        )}
        {updateAvailable && (
          <button
            className="pwa-action"
            type="button"
            onClick={() => window.dispatchEvent(new Event('smart-museum:apply-update'))}
          >
            Update app
          </button>
        )}
      </div>
      {!isOnline && (
        <p className="pwa-offline-notice" role="status">
          Offline: API data is not cached or refreshed. Displayed readings are
          demo data or earlier in-memory values; freshness follows their
          observed timestamps.
        </p>
      )}
    </>
  );
}
