/**
 * Standalone Firebase Seeding Script for FPX Market Assets
 * 
 * Usage:
 *   npx tsx scripts/seed-market-assets.ts
 * 
 * This script connects to Firestore, completely wipes any existing documents in the
 * 'market_assets' collection, and seeds strictly the 7 canonical cinema assets
 * with fresh market starting data (0 volume, clean price baseline).
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

export interface SeedMarketAsset {
  id: string;
  ticker: string;
  name: string;
  description: string;
  currentPrice: number;
  openPrice24h: number;
  change24h: number;
  priceHistory: number[];
  high24h: number;
  low24h: number;
  ath: number;
  volume24h: number;
  ownerCount: number;
  circulatingSupply: number;
  basePrice: number;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  badge?: string;
}

export const CANONICAL_MARKET_ASSETS: SeedMarketAsset[] = [
  {
    id: 'asset_dardi',
    ticker: 'DAR',
    name: 'Dardi',
    description: 'Premier FPX cinema collectible asset representing Dardi.',
    currentPrice: 420,
    openPrice24h: 420,
    change24h: 0,
    priceHistory: [420],
    high24h: 420,
    low24h: 420,
    ath: 420,
    volume24h: 0,
    ownerCount: 0,
    circulatingSupply: 0,
    basePrice: 420,
    rarity: 'Rare',
    badge: 'Cast',
  },
  {
    id: 'asset_ladi',
    ticker: 'LAD',
    name: 'Ladi',
    description: 'Iconic FPX series powerhouse collectible asset.',
    currentPrice: 550,
    openPrice24h: 550,
    change24h: 0,
    priceHistory: [550],
    high24h: 550,
    low24h: 550,
    ath: 550,
    volume24h: 0,
    ownerCount: 0,
    circulatingSupply: 0,
    basePrice: 550,
    rarity: 'Epic',
    badge: 'Cast',
  },
  {
    id: 'asset_baca_bushe',
    ticker: 'BUSH',
    name: 'Baca Bushe',
    description: 'Legendary FPX collectible asset commanding high prestige.',
    currentPrice: 680,
    openPrice24h: 680,
    change24h: 0,
    priceHistory: [680],
    high24h: 680,
    low24h: 680,
    ath: 680,
    volume24h: 0,
    ownerCount: 0,
    circulatingSupply: 0,
    basePrice: 680,
    rarity: 'Legendary',
    badge: 'Heritage',
  },
  {
    id: 'asset_la_zenun',
    ticker: 'ZEN',
    name: 'La Zenun',
    description: 'Dynamic FPX cinema collectible trading asset.',
    currentPrice: 340,
    openPrice24h: 340,
    change24h: 0,
    priceHistory: [340],
    high24h: 340,
    low24h: 340,
    ath: 340,
    volume24h: 0,
    ownerCount: 0,
    circulatingSupply: 0,
    basePrice: 340,
    rarity: 'Common',
    badge: 'Cast',
  },
  {
    id: 'asset_mixha_nagip',
    ticker: 'NAGI',
    name: 'Mixha Nagip',
    description: 'Veteran FPX character cinema collectible asset.',
    currentPrice: 490,
    openPrice24h: 490,
    change24h: 0,
    priceHistory: [490],
    high24h: 490,
    low24h: 490,
    ath: 490,
    volume24h: 0,
    ownerCount: 0,
    circulatingSupply: 0,
    basePrice: 490,
    rarity: 'Rare',
    badge: 'Cast',
  },
  {
    id: 'asset_rifati',
    ticker: 'RIF',
    name: 'Rifati',
    description: 'High-velocity FPX market asset engineered for active traders.',
    currentPrice: 310,
    openPrice24h: 310,
    change24h: 0,
    priceHistory: [310],
    high24h: 310,
    low24h: 310,
    ath: 310,
    volume24h: 0,
    ownerCount: 0,
    circulatingSupply: 0,
    basePrice: 310,
    rarity: 'Common',
    badge: 'Cast',
  },
  {
    id: 'asset_baba_ramiz',
    ticker: 'BABA',
    name: 'Baba Ramiz',
    description: 'The pinnacle of FPX Cinema market assets with ultra-exclusive market tier.',
    currentPrice: 750,
    openPrice24h: 750,
    change24h: 0,
    priceHistory: [750],
    high24h: 750,
    low24h: 750,
    ath: 750,
    volume24h: 0,
    ownerCount: 0,
    circulatingSupply: 0,
    basePrice: 750,
    rarity: 'Legendary',
    badge: 'Founder',
  },
];

async function runSeed() {
  console.log('--- FPX Cinema Market Asset Seeding Engine ---');
  
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('firebase-applet-config.json not found in project root.');
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    appId: config.appId,
  }, 'seed-runner');

  const dbId = config.firestoreDatabaseId;
  const db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);

  const colRef = collection(db, 'market_assets');

  console.log('1. Fetching existing assets in Firestore...');
  const snapshot = await getDocs(colRef);
  console.log(`Found ${snapshot.size} existing documents in 'market_assets'.`);

  if (!snapshot.empty) {
    console.log('2. Purging legacy/dummy assets from collection...');
    const deletePromises: Promise<any>[] = [];
    snapshot.forEach((docSnap) => {
      console.log(` - Deleting: ${docSnap.id}`);
      deletePromises.push(deleteDoc(docSnap.ref));
    });
    await Promise.all(deletePromises);
    console.log('Purge completed.');
  }

  console.log('3. Seeding strictly the 7 canonical assets with clean starting economy...');
  for (const asset of CANONICAL_MARKET_ASSETS) {
    const docRef = doc(db, 'market_assets', asset.id);
    await setDoc(docRef, {
      ...asset,
      createdAt: serverTimestamp(),
      lastTradeAt: serverTimestamp(),
    });
    console.log(` + Seeded: [${asset.ticker}] ${asset.name} (${asset.currentPrice} FARA)`);
  }

  console.log('---------------------------------------------------------');
  console.log('✅ Successfully seeded exactly 7 FPX Market Assets into Firestore.');
  console.log('---------------------------------------------------------');
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
