import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/main.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element was not found.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let reloadAfterUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadAfterUpdate) {
      window.location.reload();
    }
  });

  window.addEventListener('smart-museum:apply-update', () => {
    const waitingWorker = navigator.serviceWorker.controller
      ? navigator.serviceWorker.getRegistration().then((registration) => registration?.waiting)
      : Promise.resolve(null);
    waitingWorker.then((worker) => {
      if (worker) {
        reloadAfterUpdate = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  });

  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}service-worker.js`)
    .then((registration) => {
      const announceUpdate = () =>
        window.dispatchEvent(new Event('smart-museum:update-available'));

      if (registration.waiting && navigator.serviceWorker.controller) {
        announceUpdate();
      }

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        installingWorker?.addEventListener('statechange', () => {
          if (
            installingWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            announceUpdate();
          }
        });
      });

      window.addEventListener('load', () => {
        registration.update().catch((error) => {
          console.error('Smart Museum service worker update check failed.', error);
        });
      });
    })
    .catch((error) => {
      console.error('Smart Museum service worker registration failed.', error);
    });
}
