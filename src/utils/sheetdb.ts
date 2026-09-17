import { auth } from '../firebase';

/**
 * Secure SheetDB Client proxying through Backend API
 */

// Call backend API helper
export async function secureApiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const user = auth.currentUser;
  let token: string | null = null;
  
  if (user) {
    token = await user.getIdToken();
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Include Google Access Token if available
  const googleToken = localStorage.getItem('farukat_google_token');
  if (googleToken) {
    headers['x-google-token'] = googleToken;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.error || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return res.json();
}

/**
 * Generic Table Load from Local Storage (Failsafe transition)
 */
export async function sheetDbLoadTable<T>(tableName: string, userId: string, defaultVal: T): Promise<T> {
  try {
    const localData = localStorage.getItem(`farukat_db_${tableName}_${userId}`);
    if (localData) {
      return JSON.parse(localData) as T;
    }
  } catch (err) {
    console.warn(`[Local Load] failed for ${tableName}:`, err);
  }
  return defaultVal;
}

/**
 * Generic Table Save to Local Storage (Failsafe transition)
 */
export async function sheetDbSaveTable<T>(tableName: string, userId: string, payload: T): Promise<void> {
  try {
    localStorage.setItem(`farukat_db_${tableName}_${userId}`, JSON.stringify(payload));
  } catch (err) {
    console.warn(`[Local Save] failed for ${tableName}:`, err);
  }
}
