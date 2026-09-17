import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { syncFirebaseUserToAccount } from './memberSystem';
import { isQuotaError, isQuotaExceeded, markQuotaExceeded } from './quotaHelper';
import { XpAccount } from '../types';

export interface AuthResult {
  user: any;
  account: XpAccount;
}

// Generate a deterministic UID based on email for seamless fallback account lookup
export function deriveUidFromEmail(email: string): string {
  const clean = email.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `usr_${clean.slice(0, 24) || 'member'}`;
}

// Local registry helper in localStorage
function getLocalCredentialsMap(): Record<string, { pass: string; uid: string; displayName: string; photoURL: string }> {
  try {
    const raw = localStorage.getItem('farukat_registered_credentials');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalCredential(email: string, pass: string, uid: string, displayName: string, photoURL: string) {
  try {
    const map = getLocalCredentialsMap();
    map[email.toLowerCase()] = { pass, uid, displayName, photoURL };
    localStorage.setItem('farukat_registered_credentials', JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save local credential to storage:', e);
  }
}

// Backup credential to Firestore user_credentials document
async function saveCredentialBackup(email: string, pass: string, uid: string, displayName: string, photoURL: string) {
  saveLocalCredential(email, pass, uid, displayName, photoURL);
  if (isQuotaExceeded()) return;
  try {
    const docRef = doc(db, 'user_credentials', email.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    await setDoc(docRef, {
      email: email.toLowerCase(),
      pass,
      uid,
      displayName,
      photoURL,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    if (isQuotaError(err)) {
      markQuotaExceeded(err);
    }
    console.warn('Firestore credential backup warning:', err);
  }
}

// Register a fallback account in Firestore & LocalStorage
async function registerFirestoreAccount(
  email: string,
  pass: string,
  displayName: string,
  photoURL?: string
): Promise<AuthResult> {
  const uid = deriveUidFromEmail(email);
  const user = {
    uid,
    email,
    displayName: displayName || email.split('@')[0],
    photoURL: photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
    isLocalFallback: true,
  };

  const syncedAccount = await syncFirebaseUserToAccount(user);
  await saveCredentialBackup(email, pass, uid, user.displayName, user.photoURL);

  return { user, account: syncedAccount };
}

// Sign in a fallback account from Firestore or LocalStorage
async function signinFirestoreAccount(email: string, pass: string): Promise<AuthResult | null> {
  const cleanEmail = email.toLowerCase();

  // 1. Check local storage first
  const localMap = getLocalCredentialsMap();
  const localCred = localMap[cleanEmail];

  if (localCred) {
    if (localCred.pass === pass) {
      const user = {
        uid: localCred.uid,
        email: cleanEmail,
        displayName: localCred.displayName,
        photoURL: localCred.photoURL,
        isLocalFallback: true,
      };
      const account = await syncFirebaseUserToAccount(user);
      return { user, account };
    } else {
      throw new Error('Invalid email or password.');
    }
  }

  // 2. Check Firestore user_credentials document
  if (!isQuotaExceeded()) {
    try {
      const docRef = doc(db, 'user_credentials', cleanEmail.replace(/[^a-z0-9]/g, '_'));
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.pass === pass) {
          const user = {
            uid: data.uid || deriveUidFromEmail(cleanEmail),
            email: cleanEmail,
            displayName: data.displayName || cleanEmail.split('@')[0],
            photoURL: data.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
            isLocalFallback: true,
          };
          saveLocalCredential(cleanEmail, pass, user.uid, user.displayName, user.photoURL);
          const account = await syncFirebaseUserToAccount(user);
          return { user, account };
        } else {
          throw new Error('Invalid email or password.');
        }
      }
    } catch (err: any) {
      if (err?.message === 'Invalid email or password.') {
        throw err;
      }
      if (isQuotaError(err)) {
        markQuotaExceeded(err);
      }
      console.warn('Firestore credential lookup error:', err);
    }
  }

  return null;
}

// Unified Authentication Handler
export async function authenticateUser(
  mode: 'signin' | 'register',
  email: string,
  pass: string,
  displayName?: string,
  avatarUrl?: string
): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();

  if (mode === 'register') {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      const user = userCredential.user;
      
      if (displayName || avatarUrl) {
        await updateProfile(user, {
          displayName: displayName?.trim() || email.split('@')[0],
          photoURL: avatarUrl,
        });
      }

      const syncedAccount = await syncFirebaseUserToAccount({
        uid: user.uid,
        email: cleanEmail,
        displayName: displayName?.trim() || email.split('@')[0],
        photoURL: avatarUrl,
      });

      await saveCredentialBackup(cleanEmail, pass, user.uid, displayName || email.split('@')[0], avatarUrl || '');
      return { user, account: syncedAccount };
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        throw new Error('This email address is already registered. Please sign in instead.');
      }
      if (err?.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters.');
      }
      if (err?.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }

      // Fallback seamlessly to Firestore Account Store
      console.warn('Firebase Auth registration fallback activated:', err?.code || err);
      return await registerFirestoreAccount(cleanEmail, pass, displayName?.trim() || email.split('@')[0], avatarUrl);
    }
  } else {
    // Mode is 'signin'
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const user = userCredential.user;
      const syncedAccount = await syncFirebaseUserToAccount(user);
      await saveCredentialBackup(cleanEmail, pass, user.uid, user.displayName || '', user.photoURL || '');
      return { user, account: syncedAccount };
    } catch (err: any) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        // Double check fallback account in case it was created via fallback
        const fallback = await signinFirestoreAccount(cleanEmail, pass);
        if (fallback) return fallback;
        throw new Error('Invalid email or password.');
      }

      // Fallback to Firestore / Local credential lookup
      const fallback = await signinFirestoreAccount(cleanEmail, pass);
      if (fallback) return fallback;

      throw new Error('Invalid email or password.');
    }
  }
}
