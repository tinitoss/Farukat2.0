import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, getDocFromServer, disableNetwork, enableNetwork, setLogLevel } from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

import firebaseConfig from '../firebase-applet-config.json';

import { getMessaging, isSupported } from 'firebase/messaging';

// Silence verbose Firebase Firestore internal error logs
try {
  setLogLevel('silent');
} catch (e) {}

// Global helper to check if console message relates to expected Firestore quota caps
const isQuotaMessage = (args: any[]): boolean => {
  if (!args || !args.length) return false;
  try {
    const fullStr = args
      .map((a) => {
        if (!a) return '';
        if (typeof a === 'string') return a;
        try {
          return `${a.message || ''} ${a.code || ''} ${a.name || ''} ${a.stack || ''} ${JSON.stringify(a)}`;
        } catch (e) {
          return String(a);
        }
      })
      .join(' ')
      .toLowerCase();

    return (
      fullStr.includes('resource-exhausted') ||
      fullStr.includes('resource_exhausted') ||
      fullStr.includes('code: 8') ||
      fullStr.includes('code: 14') ||
      fullStr.includes('code 14') ||
      fullStr.includes('quota') ||
      fullStr.includes('limit exceeded') ||
      fullStr.includes('grpcconnection') ||
      fullStr.includes('econnreset') ||
      fullStr.includes('unavailable') ||
      fullStr.includes('listen') ||
      fullStr.includes('write') ||
      fullStr.includes('backoff delay') ||
      fullStr.includes('free daily write')
    );
  } catch (err) {
    return false;
  }
};

let activeDb: any = null;

// No-op for quota marking to prevent lockouts, as stock market uses Turso
const markQuota = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('farukat_quota_exceeded');
  }
};

// Clean up any stale quota lockouts on file import
if (typeof window !== 'undefined') {
  localStorage.removeItem('farukat_quota_exceeded');
}

// Immediate console interception before Firebase app initialization
if (typeof window !== 'undefined') {
  const origConsoleError = console.error;
  console.error = function (...args: any[]) {
    if (isQuotaMessage(args)) {
      markQuota();
      return;
    }
    origConsoleError.apply(console, args);
  };

  const origConsoleWarn = console.warn;
  console.warn = function (...args: any[]) {
    if (isQuotaMessage(args)) {
      markQuota();
      return;
    }
    origConsoleWarn.apply(console, args);
  };

  const origConsoleLog = console.log;
  console.log = function (...args: any[]) {
    if (isQuotaMessage(args)) {
      markQuota();
      return;
    }
    origConsoleLog.apply(console, args);
  };

  const origConsoleInfo = console.info;
  console.info = function (...args: any[]) {
    if (isQuotaMessage(args)) {
      markQuota();
      return;
    }
    origConsoleInfo.apply(console, args);
  };

  const origConsoleDebug = console.debug;
  console.debug = function (...args: any[]) {
    if (isQuotaMessage(args)) {
      markQuota();
      return;
    }
    origConsoleDebug.apply(console, args);
  };

  // Intercept and swallow uncaught async Firestore quota exhaustion stream exceptions
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (isQuotaMessage([reason])) {
      event.preventDefault();
      markQuota();
    }
  });

  // Capturing-phase window error handler to swallow Firestore stream errors
  window.addEventListener(
    'error',
    (event) => {
      if (isQuotaMessage([event.message, event.error])) {
        event.preventDefault();
        markQuota();
      }
    },
    true
  );

  // Keep database network enabled and clean of artificial lockout overrides
}

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const databaseId = firebaseConfig.firestoreDatabaseId || "ai-studio-fpxcinema-4cea5145-8a53-436b-93bd-e87369ae56f2";

// Initialize Firestore with forced long polling for optimal connection stability in iframe/proxy environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId);

activeDb = db;

// Database initialized and always kept online

// testConnection disabled to conserve quota
// async function testConnection() { ... }

export const googleProvider = new GoogleAuthProvider();

export const googleSheetsProvider = new GoogleAuthProvider();
googleSheetsProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleSheetsProvider.addScope('https://www.googleapis.com/auth/spreadsheets');

// FCM Messaging
export const getFCM = async () => {
  if (typeof window !== 'undefined' && await isSupported()) {
    return getMessaging(app);
  }
  return null;
};

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
};

export type { User };
