/**
 * Circuit Breaker Helper for Firebase Firestore Quota Limit Exceeded Management
 */

export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  const str = String(err || '').toLowerCase();

  return (
    code.includes('resource-exhausted') ||
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    str.includes('resource_exhausted') ||
    str.includes('quota')
  );
}

export function isQuotaExceeded(): boolean {
  return false;
}

export function resetQuotaExceeded(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('farukat_quota_exceeded');
    window.dispatchEvent(new CustomEvent('farukat_firestore_quota_cleared'));
  }
}

import { db } from '../firebase';
import { disableNetwork } from 'firebase/firestore';

export function markQuotaExceeded(err?: any): void {
  if (typeof window !== 'undefined') {
    // Keep quota lock disabled so Turso stock market remains active
    console.warn('Firebase Quota event intercepted. Market remains active through Turso.');
  }
}

/**
 * React Hook for observing Firebase Quota Limit Exhausted state in real-time.
 */
import { useState, useEffect } from 'react';

export function useFirebaseQuota() {
  return false;
}
