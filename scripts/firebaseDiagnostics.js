/**
 * Comprehensive Firebase Diagnostic Script
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { getAuth, signInAnonymously, signOut } from 'firebase/auth';

async function runDiagnostics() {
  console.log('--- FIREBASE DIAGNOSTIC SUITE ---');
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const app = initializeApp(config, 'diag-runner-script');
  const dbId = config.firestoreDatabaseId || "ai-studio-fpxcinema-4cea5145-8a53-436b-93bd-e87369ae56f2";
  const db = getFirestore(app, dbId);
  const auth = getAuth(app);

  console.log('1. Checking Auth Quotas...');
  try {
    const cred = await signInAnonymously(auth);
    console.log(' ✅ Anonymous Auth test passed. UID:', cred.user.uid);
    await signOut(auth);
  } catch (err) {
    console.warn(' ⚠️ Auth Check Notice:', err.code || err.message);
  }

  console.log('2. Checking Firestore Read/Write & Security Rules...');
  try {
    const snap = await getDocs(collection(db, 'market_assets'));
    console.log(` ✅ Firestore market_assets read passed. Documents: ${snap.size}`);
  } catch (err) {
    console.warn(' ⚠️ Firestore Read Notice:', err.code || err.message);
  }

  console.log('3. Checking Composite Indexes...');
  try {
    const q = query(collection(db, 'market_assets'), where('rarity', '==', 'Legendary'), orderBy('currentPrice', 'desc'), limit(5));
    const snap = await getDocs(q);
    console.log(` ✅ Index check passed. Documents: ${snap.size}`);
  } catch (err) {
    console.warn(' ⚠️ Index Notice:', err.code || err.message);
  }
}

runDiagnostics().catch(console.error);
