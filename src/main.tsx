import './utils/quotaConsoleInterceptor';
import {StrictMode, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LanguageProvider } from './i18n/LanguageContext';
import './index.css';
import OneSignal from 'react-onesignal';

// OneSignal initialization component
const OneSignalWrapper: React.FC = () => {
  useEffect(() => {
    OneSignal.init({
      appId: "fe1ab163-5deb-4365-b20a-7e4713b52221",
      safari_web_id: "web.onesignal.auto.313afc18-65a3-4cb5-bd8a-eabd69c6e4d8",
      allowLocalhostAsSecureOrigin: true, // Needed for preview environment
    });
  }, []);
  return null;
};

// Clear out any broken development service workers
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
} else if ('serviceWorker' in navigator) {
  // Register production Service Worker
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('ServiceWorker registration failed: ', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <OneSignalWrapper />
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
);

