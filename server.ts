import express from 'express';
import path from 'path';
import cors from 'cors';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { google } from 'googleapis';
import fs from 'fs';
import * as admin from 'firebase-admin';
import { initializeApp, getApps, getApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json';
import {
  initTursoTables,
  getOrCreateUserProfile,
  updateTursoUserProfile,
  lookupTursoMember,
  getAllTursoMembers,
  getUserXp,
  awardUserXp,
  getContentLikes,
  getUserLikedContentIds,
  toggleLike,
  getCommentsForContent,
  createComment,
  deleteComment,
  toggleCommentLike,
  getCommentLikes,
  updateWatchProgress,
  getUserWatchProgressList,
  clearUserWatchProgress,
  claimWatchReward,
  getTursoMediaCatalogState,
  saveTursoMediaCatalogState,
  processReferralSignup,
  syncTursoWatchPartyRoom,
  updateTursoWatchPartyPlayback,
  getTursoWatchPartyRoom,
  syncTursoUserStreak,
  getTursoAchievements,
  unlockTursoAchievement,
  getTursoTierProgress,
  syncTursoTierProgress,
  getTursoWeeklyChallenges,
  initTursoWeeklyChallenges,
  updateTursoWeeklyChallengeProgress,
  getCachedLeaderboard,
  getUserLeaderboardRank,
  refreshLeaderboardCache,
  syncExternalRealUsersToTurso,
  createInAppNotificationRecord,
  getInAppNotifications,
  markNotificationRead,
  deleteInAppNotification,
  getTopCatalogStats
} from './src/server/tursoDb';
import { getBackupDb, fetchCloudSqlAuditLogs, fetchCloudSqlMessages, backupRecordToCloudSql } from './src/db/backupDb';

// Firebase Client SDK for resilient firestore access
import { initializeApp as initializeClientApp } from 'firebase/app';
import { 
  getFirestore as getClientFirestore, 
  initializeFirestore,
  setLogLevel,
  collection as clientCollection, 
  getDocs as getClientDocs, 
  doc as clientDoc, 
  setDoc as setClientDoc,
  updateDoc as updateClientDoc,
  deleteDoc as clientDeleteDoc,
  serverTimestamp as clientServerTimestamp,
  query as clientQuery,
  limit as clientLimit,
  runTransaction as runClientTransaction
} from 'firebase/firestore';

try {
  setLogLevel('silent');
} catch (e) {}

// Firebase Admin SDK safe initialization
if (!getApps().length) {
  try {
    const config = firebaseConfig as any;
    // Prioritize environment project ID, then config
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || config.projectId || process.env.GCLOUD_PROJECT;
    
    initializeApp({
      projectId: projectId,
      credential: applicationDefault()
    });
    console.log(`[Firebase Admin] Initialized. Project ID: ${projectId || 'auto-detected'}`);
  } catch (err: any) {
    console.error('[Firebase Admin] Initialization failed:', err.message);
  }
}

// Helper to retrieve firestore database safely
let lastLogTime = 0;

// Initialize Client SDK as a resilient fallback
let clientDbInstance: any;

let serverQuotaExceeded = false;
function isServerQuotaError(err: any): boolean {
  if (!err) return false;
  const str = String(err.message || err || '').toLowerCase();
  return str.includes('resource-exhausted') || str.includes('resource_exhausted') || str.includes('quota') || str.includes('code: 8');
}
function handleServerQuotaError(err: any) {
  if (isServerQuotaError(err)) {
    if (!serverQuotaExceeded) {
      serverQuotaExceeded = true;
      console.warn('[SERVER CIRCUIT BREAKER] Firestore Quota Exceeded detected on Node.js Server. Halting background write streams.');
    }
    return true;
  }
  return false;
}

export function getClientFirestoreInstance() {
  if (clientDbInstance) return clientDbInstance;
  
  try {
    const config = firebaseConfig as any;
    const clientApp = initializeClientApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      appId: config.appId
    }, 'client-backend');
    
    const dbId = config.firestoreDatabaseId;
    if (dbId && dbId !== '(default)') {
      clientDbInstance = initializeFirestore(clientApp, {
        experimentalForceLongPolling: true,
      }, dbId);
    } else {
      clientDbInstance = initializeFirestore(clientApp, {
        experimentalForceLongPolling: true,
      });
    }
    return clientDbInstance;
  } catch (err: any) {
    console.error('[Firebase Client] Initialization failed:', err.message);
  }
  return undefined;
}

function getAdminFirestore() {
  const app = getApps().length > 0 ? getApp() : undefined;
  if (!app) return undefined;

  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let dbId: string | undefined;
  const config = firebaseConfig as any;
  if (config && config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
    dbId = config.firestoreDatabaseId;
  }

  // Fallback DB ID from metadata if config is missing it
  if (!dbId) {
    dbId = "(default)";
  }

  // Periodically log the configuration to help debugging
  const now = Date.now();
  if (now - lastLogTime > 60000) {
    console.log(`[Firestore Admin] Project: ${app.options.projectId || 'auto'}, DB: ${dbId}`);
    lastLogTime = now;
  }

  try {
    // If dbId is specified and not (default), use it.
    if (dbId && dbId !== '(default)') {
      return getFirestore(app, dbId);
    }
    // Fallback to default database
    return getFirestore(app);
  } catch (err: any) {
    console.warn(`[Firestore Admin] Failed to get Firestore instance for DB "${dbId}": ${err.message}. Attempting default.`);
    try {
      return getFirestore(app);
    } catch (fallbackErr: any) {
      console.error('[Firestore Admin] Critical: Could not get any Firestore instance.', fallbackErr.message);
      return undefined;
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '195kDKDJoWckJ_A85TtbnVgTL8aG-5npsYklfXe1EA4w';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// -----------------------------------------------------------------------------
// GOOGLE SHEETS API UTILS
// -----------------------------------------------------------------------------
async function getSheetsClient(accessToken?: string) {
  try {
    if (accessToken) {
      console.log('[Google API] Using User Access Token');
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      return google.sheets({ version: 'v4', auth });
    }

    // Fallback to Application Default Credentials (Service Account)
    console.log('[Google API] Falling back to Service Account (ADC)');
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    const projectId = await auth.getProjectId();
    console.log(`[Google API] Service Account Project ID: ${projectId}`);
    
    return google.sheets({ version: 'v4', auth: authClient as any });
  } catch (err: any) {
    console.error('[Google Auth Error]:', err.message);
    throw err;
  }
}

async function getSheetData(sheets: any, range: string) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return response.data.values || [];
}

async function appendSheetData(sheets: any, range: string, values: any[][]) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

async function updateSheetData(sheets: any, range: string, values: any[][]) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

async function deleteSheetRow(sheets: any, sheetName: string, rowIndex: number) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = spreadsheet.data.sheets.find((s: any) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found in spreadsheet.`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1
          }
        }
      }]
    }
  });
}

// Security Configurations
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({
  origin: true, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-google-token']
}));

// URL Normalizer for Serverless Deployments (Vercel & Netlify)
app.use((req, res, next) => {
  if (req.url) {
    if (req.url.startsWith('/.netlify/functions/api')) {
      req.url = req.url.replace('/.netlify/functions/api', '/api');
    }
    if (!req.url.startsWith('/api/') && req.url !== '/api') {
      if (
        req.url.startsWith('/turso') ||
        req.url.startsWith('/userdata') ||
        req.url.startsWith('/social') ||
        req.url.startsWith('/xp') ||
        req.url.startsWith('/leaderboard') ||
        req.url.startsWith('/auth')
      ) {
        req.url = '/api' + (req.url.startsWith('/') ? '' : '/') + req.url;
      }
    }
  }
  next();
});

// Add security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Environment secrets
const SHEETDB_URL = process.env.SHEETDB_API_URL || 'https://sheetdb.io/api/v1/q2s5i3bw5xvan';

// -----------------------------------------------------------------------------
// SHEETDB CONCURRENCY QUEUE & CACHE
// -----------------------------------------------------------------------------
let isProcessingQueue = false;
const requestQueue: { resolve: (val: any) => void; reject: (err: any) => void; fn: () => Promise<any> }[] = [];

// Simple Cache for GET requests (SheetDB free tier is very limited)
const dbCache: Record<string, { data: any; timestamp: number }> = {};
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL = 60000; // 1 minute cache for read operations

// Prevent redundant writes for identical data
const writeCache: Record<string, { hash: string; timestamp: number }> = {};
const WRITE_COOLDOWN = 30000; // 30 seconds cooldown between writes for same key/data

function getHash(obj: any): string {
  return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex');
}

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  isProcessingQueue = true;
  
  while (requestQueue.length > 0) {
    const { resolve, reject, fn } = requestQueue.shift()!;
    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    }
    // Artificial spacing between requests to respect free-tier rate limits (1500ms)
    // 1.5 seconds per request to keep daily quota low
    await new Promise(res => setTimeout(res, 1500));
  }
  
  isProcessingQueue = false;
}

function queuedSheetDbFetch(endpoint = '', options: any = {}) {
  const method = options.method || 'GET';
  const cacheKey = endpoint || 'root';
  
  // Use cache for GET requests
  if (method === 'GET') {
    const cached = dbCache[cacheKey];
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return Promise.resolve(cached.data);
    }

    // Deduplicate in-flight requests
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }
  }

  // Cooldown for POST/PUT requests with same data
  if (method === 'POST' || method === 'PUT') {
    const body = options.body ? JSON.parse(options.body) : null;
    if (body) {
      const dataHash = getHash(body);
      const writeKey = `${method}:${endpoint}:${dataHash}`;
      const lastWrite = writeCache[writeKey];
      
      if (lastWrite && (Date.now() - lastWrite.timestamp) < WRITE_COOLDOWN) {
        console.log(`[QUOTA GUARD] Skipping redundant ${method} request for ${endpoint}`);
        return Promise.resolve({ success: true, cached: true });
      }
      writeCache[writeKey] = { hash: dataHash, timestamp: Date.now() };
    }
  }

  const promise = new Promise((resolve, reject) => {
    requestQueue.push({
      resolve,
      reject,
      fn: async () => {
        console.log(`[DATABASE] Requesting ${method} ${endpoint}... Queue size: ${requestQueue.length}`);
        const result = await sheetDbFetch(endpoint, options);
        // Cache successful GET results
        if (method === 'GET') {
          dbCache[cacheKey] = { data: result, timestamp: Date.now() };
        } else {
          // Invalidate GET cache on write operations to ensure fresh data
          // We primarily care about the root cache since loadTable uses it
          delete dbCache['root'];
          delete dbCache[endpoint];
        }
        return result;
      }
    });
    processQueue();
  });

  if (method === 'GET') {
    inFlightRequests.set(cacheKey, promise);
    promise.finally(() => {
      inFlightRequests.delete(cacheKey);
    });
  }

  return promise;
}

// -----------------------------------------------------------------------------
// RATE LIMITING & SECURITY logging
// -----------------------------------------------------------------------------
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimits: Record<string, RateLimitRecord> = {};

function rateLimiter(limit: number, windowMs: number, name = 'Action') {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    if (!rateLimits[key] || rateLimits[key].resetTime < now) {
      rateLimits[key] = { count: 1, resetTime: now + windowMs };
      return next();
    }

    rateLimits[key].count++;
    if (rateLimits[key].count > limit) {
      console.warn(`[SECURITY ALERT] Rate limit exceeded for ${name} by IP: ${ip} on path: ${req.path}`);
      return res.status(429).json({ error: `Too many requests for ${name}. Please wait a moment and try again.` });
    }
    next();
  };
}

// Simple Security Event Logging
function logSecurityEvent(event: string, ip: string, details: any) {
  console.log(`[SECURITY EVENT] [${new Date().toISOString()}] - ${event} | IP: ${ip} | Details:`, JSON.stringify(details));
}

// Health Check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Verification Email API
app.post('/api/auth/send-verification-email', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (!user || user.uid === 'guest') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const link = await getAuth().generateEmailVerificationLink(user.email);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: parseInt(process.env.SMTP_PORT || '587') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    console.log('[Auth API] SMTP configured for host:', process.env.SMTP_HOST, 'port:', process.env.SMTP_PORT, 'user:', process.env.SMTP_USER ? 'SET' : 'NOT SET');

    const mailOptions = {
      from: '"FARUKAT" <altinberisha434@gmail.com>',
      to: user.email,
      subject: 'Verify your email address — FARUKAT',
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E2B14C;">Verify your email address</h2>
          <p>Hello ${user.name || 'User'},</p>
          <p>Thank you for creating your FARUKAT account.</p>
          <p>Please verify your email address to finish setting up your account.</p>
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #E2B14C; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold;">Verify Email Address</a>
          <p>If the button doesn't work, copy and paste the link below into your browser:</p>
          <p style="word-break: break-all;">${link}</p>
          <p>If you did not create this account, you can safely ignore this email.</p>
          <p>FARUKAT<br>Secure account verification</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Auth API] Send verification email error:', err.message);
    return res.status(500).json({ error: 'Failed to send verification email.' });
  }
});

// Authentication Middleware
async function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  const guestUser = {
    uid: 'guest',
    email: 'guest@farukat.cinema',
    name: 'Guest Member',
    admin: false,
    googleToken: req.headers['x-google-token']
  };

  if (!token || token === 'guest' || token === 'null' || token === 'undefined') {
    (req as any).user = guestUser;
    return next();
  }

  // Firebase tokens are standard JWTs: [header].[payload].[signature]
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      (req as any).user = guestUser;
      return next();
    }

    // Decode payload safely
    const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64Url, 'base64').toString('utf8'));
    console.log('[Auth API] Decoded JWT payload:', payload);
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      (req as any).user = guestUser;
      return next();
    }

    const isAdminEmail = payload.email === 'altinberisha434@gmail.com';

    (req as any).user = {
      uid: payload.user_id || payload.sub || 'guest',
      email: payload.email || 'guest@farukat.cinema',
      name: payload.name || payload.email?.split('@')[0] || 'Guest Member',
      admin: payload.admin === true || isAdminEmail,
      googleToken: req.headers['x-google-token']
    };
    next();
  } catch (err) {
    console.warn('[AUTH] Token decoding fallback to guest user session:', err);
    (req as any).user = guestUser;
    next();
  }
}

// -----------------------------------------------------------------------------
// SECURE SHEETDB PROXY (SERVER-SIDE ONLY)
// -----------------------------------------------------------------------------
async function sheetDbFetch(endpoint = '', options: any = {}, retryCount = 0): Promise<any> {
  const cleanUrl = SHEETDB_URL.replace(/\/$/, '');
  const url = `${cleanUrl}${endpoint}`;
  
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (res.status === 429 && retryCount < 5) {
      const waitTime = Math.pow(2, retryCount) * 1200 + Math.random() * 800;
      console.warn(`[DATABASE] Rate limit hit (429). Retrying in ${Math.round(waitTime)}ms... (Attempt ${retryCount + 1}/5)`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return sheetDbFetch(endpoint, options, retryCount + 1);
    }

    if (!res.ok) {
      if (res.status === 404 || res.status === 400) {
        return null;
      }
      throw new Error(`Database service returned error (${res.status})`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err: any) {
    if (err.message?.includes('429') && retryCount < 5) {
      const waitTime = Math.pow(2, retryCount) * 1200 + Math.random() * 800;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return sheetDbFetch(endpoint, options, retryCount + 1);
    }
    throw err;
  }
}

async function loadTable<T>(tableName: string, userId: string, defaultVal: T): Promise<T> {
  try {
    const rows = await queuedSheetDbFetch('') as any[];
    if (!rows || !Array.isArray(rows)) {
      console.warn(`[DATABASE] Table ${tableName} load failed: No rows found or invalid format.`);
      return defaultVal;
    }

    let targetId = `${tableName}_${userId}`;
    
    // Find row with case-insensitive header support
    const matched = rows.find((r: any) => {
      const rowId = r.id || r.ID || r.Id;
      return String(rowId) === String(targetId);
    });

    if (matched) {
      const data = matched.xp || matched.XP || matched.Xp || matched.data || matched.DATA;
      if (data) return JSON.parse(data) as T;
    }
  } catch (err) {
    console.error(`Error loading table ${tableName}:`, err);
  }
  return defaultVal;
}

async function saveTable<T>(tableName: string, userId: string, payload: T): Promise<void> {
  try {
    let targetId = `${tableName}_${userId}`;
    
    const rows = await queuedSheetDbFetch('') as any[];
    const existing = Array.isArray(rows) ? rows.find((r: any) => {
      const rowId = r.id || r.ID || r.Id;
      return String(rowId) === String(targetId);
    }) : null;
    
    const payloadStr = JSON.stringify(payload);

    if (existing) {
      // Preserve existing header casing if found
      const idKey = existing.id ? 'id' : (existing.ID ? 'ID' : 'id');
      const xpKey = existing.xp ? 'xp' : (existing.XP ? 'XP' : 'xp');
      const nameKey = existing.names ? 'names' : 'names';
      const ageKey = existing.age ? 'age' : 'age';

      const updatedRow = {
        [idKey]: targetId,
        [nameKey]: existing.names || tableName,
        [ageKey]: existing.age || userId,
        [xpKey]: payloadStr,
      };
      
      await queuedSheetDbFetch(`/id/${encodeURIComponent(targetId)}`, {
        method: 'PUT',
        body: JSON.stringify({ data: updatedRow }),
      });
      console.log(`[DATABASE] Updated existing record: ${targetId}`);
    } else {
      const newRow = {
        id: targetId,
        names: tableName,
        age: userId,
        xp: payloadStr,
      };
      await queuedSheetDbFetch('', {
        method: 'POST',
        body: JSON.stringify({ data: [newRow] }),
      });
      console.log(`[DATABASE] Created new record: ${targetId}`);
    }
  } catch (err) {
    console.error(`Error saving table ${tableName}:`, err);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// SECURE YOUTUBE METADATA PROXY
// -----------------------------------------------------------------------------

app.get('/api/youtube-title', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.json({ title: 'YouTube Video' });
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    
    // Highly resilient fetch with abort controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.title) {
        return res.json({ title: data.title });
      }
    }
  } catch (err: any) {
    // Graceful warning in logs instead of standard console.error to keep logs perfectly clean
    console.warn('[YouTube Proxy] Fallback to default title:', err?.message || err);
  }

  return res.json({ title: 'YouTube Video' });
});

// Helper to parse ISO 8601 duration (e.g. "PT5M14S") into minutes:seconds and seconds
function parseISO8601ToDuration(iso: string): { formatted: string; totalSeconds: number } {
  if (!iso) return { formatted: '0:00', totalSeconds: 0 };
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return { formatted: '0:00', totalSeconds: 0 };
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  let formatted = '';
  if (hours > 0) {
    formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    formatted = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return { formatted, totalSeconds };
}

function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) return match[1];
  const viMatch = trimmed.match(/\/vi\/([\w-]{11})\//);
  if (viMatch && viMatch[1]) return viMatch[1];
  return null;
}

// Verified YouTube video durations (parsed from YouTube Data API ISO 8601)
const KNOWN_YOUTUBE_DURATIONS: Record<string, { isoDuration: string; duration: string; totalSeconds: number }> = {
  'wFB3buLcIFs': { isoDuration: 'PT5M14S', duration: '5:14', totalSeconds: 314 },
  'XwhzYH4mENc': { isoDuration: 'PT7M34S', duration: '7:34', totalSeconds: 454 },
  'ostAVFmQHDg': { isoDuration: 'PT5M41S', duration: '5:41', totalSeconds: 341 },
  'Ms0xIN8DdfQ': { isoDuration: 'PT2M10S', duration: '2:10', totalSeconds: 130 },
  'o5jTPN9s6i0': { isoDuration: 'PT14M48S', duration: '14:48', totalSeconds: 888 },
  'ZQcwVonnxFQ': { isoDuration: 'PT2M57S', duration: '2:57', totalSeconds: 177 },
  'y2xDrlAQE2s': { isoDuration: 'PT42M47S', duration: '42:47', totalSeconds: 2567 },
  'm7nyC3zeli0': { isoDuration: 'PT34M36S', duration: '34:36', totalSeconds: 2076 },
  'VVPHn0t0Cxw': { isoDuration: 'PT14M07S', duration: '14:07', totalSeconds: 847 },
  'j9OouNK3hf8': { isoDuration: 'PT11M20S', duration: '11:20', totalSeconds: 680 },
  '6UBKlGrw0B4': { isoDuration: 'PT13M45S', duration: '13:45', totalSeconds: 825 },
  'Ljh6-zE0vxs': { isoDuration: 'PT15M10S', duration: '15:10', totalSeconds: 910 },
  'obo8qEoXn_4': { isoDuration: 'PT12M15S', duration: '12:15', totalSeconds: 735 },
  'v5tiUtEZwRM': { isoDuration: 'PT6M50S', duration: '6:50', totalSeconds: 410 },
  'eEjI-2ko69I': { isoDuration: 'PT36M28S', duration: '36:28', totalSeconds: 2188 },
  '279NomDzT_E': { isoDuration: 'PT41M24S', duration: '41:24', totalSeconds: 2484 },
  'QRGoMPuu0yo': { isoDuration: 'PT31M41S', duration: '31:41', totalSeconds: 1901 },
  'GkuZJ_fVk4U': { isoDuration: 'PT2M45S', duration: '2:45', totalSeconds: 165 },
  'SViAOT5QZOE': { isoDuration: 'PT3M12S', duration: '3:12', totalSeconds: 192 },
  'OMObY1JDvZU': { isoDuration: 'PT4M10S', duration: '4:10', totalSeconds: 250 },
  'nSTVvdQkrMU': { isoDuration: 'PT3M30S', duration: '3:30', totalSeconds: 210 },
  'MaPBUm8PU-E': { isoDuration: 'PT2M50S', duration: '2:50', totalSeconds: 170 },
  'HRxZBolpZG8': { isoDuration: 'PT4M45S', duration: '4:45', totalSeconds: 285 },
  '_9e8KYnsuFA': { isoDuration: 'PT3M15S', duration: '3:15', totalSeconds: 195 },
  'aYznVCZtyTg': { isoDuration: 'PT2M58S', duration: '2:58', totalSeconds: 178 },
  '4pBvbSk2MCE': { isoDuration: 'PT3M40S', duration: '3:40', totalSeconds: 220 },
  '73VU9J14vF0': { isoDuration: 'PT4M15S', duration: '4:15', totalSeconds: 255 },
  't7oAcrlNKRA': { isoDuration: 'PT2M35S', duration: '2:35', totalSeconds: 155 },
  'AyocflRJrPM': { isoDuration: 'PT3M05S', duration: '3:05', totalSeconds: 185 },
  '0LYunjkdI5A': { isoDuration: 'PT3M50S', duration: '3:50', totalSeconds: 230 },
};

app.get('/api/youtube-duration', async (req, res) => {
  const queryParam = (req.query.id as string) || (req.query.videoId as string) || (req.query.url as string);
  if (!queryParam) {
    return res.status(400).json({ error: 'Video ID or URL is required.' });
  }

  const videoId = extractYouTubeId(queryParam);
  if (!videoId) {
    return res.status(400).json({ error: 'Could not extract a valid YouTube video ID.' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || 'AIzaSyDknVreudrqu_mzFKxfXnaXj5ZyzKAJO7c';

  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const ytUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`;
      const response = await fetch(ytUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const isoDuration = data.items[0].contentDetails?.duration;
          if (isoDuration) {
            const { formatted, totalSeconds } = parseISO8601ToDuration(isoDuration);
            return res.json({
              success: true,
              videoId,
              isoDuration,
              duration: formatted,
              totalSeconds,
              source: 'youtube_api_v3'
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[YouTube Duration API] Error fetching from YouTube Data API:', err?.message || err);
    }
  }

  // Fallback to verified catalog registry if available
  if (KNOWN_YOUTUBE_DURATIONS[videoId]) {
    const info = KNOWN_YOUTUBE_DURATIONS[videoId];
    return res.json({
      success: true,
      videoId,
      isoDuration: info.isoDuration,
      duration: info.duration,
      totalSeconds: info.totalSeconds,
      source: 'verified_catalog'
    });
  }

  return res.status(404).json({
    success: false,
    videoId,
    error: 'Duration could not be retrieved from YouTube API'
  });
});

// -----------------------------------------------------------------------------
// SECURE DATA ENDPOINTS (GOOGLE SHEETS MIGRATED)
// -----------------------------------------------------------------------------

app.get('/api/userdata/load', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { tableName } = req.query;

  if (!tableName) {
    return res.status(400).json({ error: 'Table name is required.' });
  }

  try {
    const sheets = await getSheetsClient(user.googleToken);
    const sheetName = tableName === 'downloads' ? 'Downloads' : 'UserAccounts';
    const rows = await getSheetData(sheets, `${sheetName}!A:C`);
    
    // Rows: id | userId | data
    const matched = rows.find((r: any) => r[1] === user.uid);
    if (matched && matched[2]) {
      return res.json({ success: true, data: JSON.parse(matched[2]) });
    }
    
    return res.json({ success: true, data: null });
  } catch (err: any) {
    console.error(`Google Sheets Load ${tableName} Error:`, err.message);
    return res.status(500).json({ error: 'Failed to load user data.' });
  }
});

app.post('/api/userdata/save', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { tableName, payload } = req.body;

  if (!tableName || payload === undefined) {
    return res.status(400).json({ error: 'Table name and payload are required.' });
  }

  try {
    const sheets = await getSheetsClient(user.googleToken);
    const sheetName = tableName === 'downloads' ? 'Downloads' : 'UserAccounts';
    const rows = await getSheetData(sheets, `${sheetName}!A:C`);
    
    const existingIndex = rows.findIndex((r: any, idx: number) => idx > 0 && r[1] === user.uid);
    const dataStr = JSON.stringify(payload);

    if (existingIndex !== -1) {
      // Update
      const updatedRow = [rows[existingIndex][0], user.uid, dataStr];
      await updateSheetData(sheets, `${sheetName}!A${existingIndex + 1}:C${existingIndex + 1}`, [updatedRow]);
    } else {
      // Create
      const newRow = [`${tableName}-${Date.now()}`, user.uid, dataStr];
      await appendSheetData(sheets, `${sheetName}!A:C`, [newRow]);
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error(`Google Sheets Save ${tableName} Error:`, err.message);
    return res.status(500).json({ error: 'Failed to save user data.' });
  }
});

// -----------------------------------------------------------------------------
// SECURE SOCIAL ENDPOINTS (GOOGLE SHEETS)
// -----------------------------------------------------------------------------

app.get('/api/social/likes', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { contentId } = req.query;
  if (!contentId) return res.status(400).json({ error: 'Content ID required' });

  try {
    const sheets = await getSheetsClient(user.googleToken);
    const rows = await getSheetData(sheets, 'Likes!A:D');
    
    // Rows: id | userId | contentId | createdAt
    const likes = rows.slice(1).filter((r: any) => r[2] === String(contentId));
    const userLiked = likes.some((r: any) => r[1] === user.uid);

    return res.json({
      likesCount: likes.length,
      userLiked
    });
  } catch (err: any) {
    console.error('Google Sheets Likes Error:', err.message);
    return res.json({ likesCount: 0, userLiked: false });
  }
});

app.post('/api/social/toggle-like', authenticateToken, rateLimiter(15, 60 * 1000, 'Like Toggle'), async (req, res) => {
  const user = (req as any).user;
  const { contentId } = req.body;
  if (!contentId) return res.status(400).json({ error: 'Content ID required' });

  try {
    const sheets = await getSheetsClient(user.googleToken);
    const rows = await getSheetData(sheets, 'Likes!A:D');
    
    const existingIndex = rows.findIndex((r: any, idx: number) => idx > 0 && r[1] === user.uid && r[2] === String(contentId));

    if (existingIndex !== -1) {
      // Remove Like
      await deleteSheetRow(sheets, 'Likes', existingIndex);
      
      const updatedRows = await getSheetData(sheets, 'Likes!A:D');
      const likes = updatedRows.slice(1).filter((r: any) => r[2] === String(contentId));
      return res.json({ active: false, likesCount: likes.length });
    } else {
      // Add Like
      const newRow = [`like-${Date.now()}`, user.uid, String(contentId), new Date().toISOString()];
      await appendSheetData(sheets, 'Likes!A:D', [newRow]);
      
      const updatedRows = await getSheetData(sheets, 'Likes!A:D');
      const likes = updatedRows.slice(1).filter((r: any) => r[2] === String(contentId));
      return res.json({ active: true, likesCount: likes.length });
    }
  } catch (err: any) {
    console.error('Google Sheets Toggle Like Error:', err.message);
    return res.status(500).json({ error: 'Failed to sync like with Google Sheets.' });
  }
});

app.get('/api/social/comments', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { contentId } = req.query;
  if (!contentId) return res.status(400).json({ error: 'Content ID required' });

  try {
    const sheets = await getSheetsClient(user.googleToken);
    const rows = await getSheetData(sheets, 'Comments!A:G');
    
    // Rows: id | userId | contentId | comment | createdAt | updatedAt | deleted
    const comments = rows.slice(1)
      .filter((r: any) => r[2] === String(contentId) && r[6] !== 'true')
      .map((r: any) => ({
        commentId: r[0],
        userId: r[1],
        contentId: r[2],
        text: r[3],
        createdAt: r[4],
        updatedAt: r[5],
        username: 'Cinema Member',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ comments });
  } catch (err: any) {
    console.error('Google Sheets Comments Error:', err.message);
    return res.json({ comments: [] });
  }
});

app.post('/api/social/add-comment', authenticateToken, rateLimiter(8, 60 * 1000, 'Comment Post'), async (req, res) => {
  const user = (req as any).user;
  const { contentId, text } = req.body;
  if (!contentId || !text) return res.status(400).json({ error: 'Missing data' });

  const sanitizedText = text.trim().substring(0, 500)
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');

  try {
    const sheets = await getSheetsClient(user.googleToken);
    const now = new Date().toISOString();
    const id = `comm-${Date.now()}`;
    const newRow = [id, user.uid, String(contentId), sanitizedText, now, now, 'false'];
    
    await appendSheetData(sheets, 'Comments!A:G', [newRow]);

    return res.json({
      comment: {
        commentId: id,
        userId: user.uid,
        contentId,
        text: sanitizedText,
        createdAt: now,
        username: user.name || 'Cinema Member',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
      }
    });
  } catch (err: any) {
    console.error('Google Sheets Add Comment Error:', err.message);
    return res.status(500).json({ error: 'Failed to add comment.' });
  }
});

app.post('/api/social/delete-comment', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { commentId } = req.body;
  if (!commentId) return res.status(400).json({ error: 'Comment ID required' });

  try {
    const sheets = await getSheetsClient(user.googleToken);
    const rows = await getSheetData(sheets, 'Comments!A:G');
    
    const rowIndex = rows.findIndex((r: any, idx: number) => idx > 0 && r[0] === commentId);
    if (rowIndex === -1) return res.status(404).json({ error: 'Comment not found' });
    
    if (rows[rowIndex][1] !== user.uid) {
      return res.status(403).json({ error: 'Unauthorized deletion' });
    }

    // Mark as deleted
    const updatedRow = [...rows[rowIndex]];
    updatedRow[6] = 'true';
    updatedRow[5] = new Date().toISOString();

    await updateSheetData(sheets, `Comments!A${rowIndex + 1}:G${rowIndex + 1}`, [updatedRow]);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('Google Sheets Delete Comment Error:', err.message);
    return res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

app.get('/api/social/user-likes', authenticateToken, async (req, res) => {
  const user = (req as any).user;

  try {
    const sheets = await getSheetsClient(user.googleToken);
    const rows = await getSheetData(sheets, 'Likes!A:D');
    
    // Rows: id | userId | contentId | createdAt
    const userLikes = rows.slice(1)
      .filter((r: any) => r[1] === user.uid)
      .map((r: any) => r[2]);

    return res.json({ success: true, likes: userLikes });
  } catch (err: any) {
    console.error('Google Sheets User Likes Error:', err.message);
    return res.json({ success: false, likes: [] });
  }
});

// -----------------------------------------------------------------------------
// SECURE XP ENDPOINTS (GOOGLE SHEETS)
// -----------------------------------------------------------------------------

const PREDEFINED_ACTIONS: Record<string, number> = {
  'Shared Cinema Review Comment': 15,
  'Movie Engagement Like': 5,
  'Daily Streaming Login': 25,
  'Video Completion Bonus': 50,
  'Profile Customization': 30
};

app.get('/api/xp/account', authenticateToken, async (req, res) => {
  const user = (req as any).user;

  try {
    const sheets = await getSheetsClient(user.googleToken);
    const rows = await getSheetData(sheets, 'XP!A:F');
    
    // Rows: id | userId | action | amount | referenceId | createdAt
    const userTransactions = rows.slice(1).filter((r: any) => r[1] === user.uid);
    const totalXp = userTransactions.reduce((sum: number, r: any) => sum + parseInt(r[3] || '0', 10), 0);

    return res.json({
      success: true,
      xp: totalXp,
      transactions: userTransactions.map((r: any) => ({
        id: r[0],
        action: r[2],
        amount: parseInt(r[3], 10),
        referenceId: r[4],
        createdAt: r[5]
      }))
    });
  } catch (err: any) {
    console.error('Google Sheets XP Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch XP data' });
  }
});

app.post('/api/xp/award', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { action, referenceId } = req.body;

  const amount = PREDEFINED_ACTIONS[action];
  if (!amount) return res.status(400).json({ error: 'Invalid action' });

  try {
    const sheets = await getSheetsClient(user.googleToken);
    const rows = await getSheetData(sheets, 'XP!A:F');

    // Prevent duplicate awards for certain actions/referenceIds if needed
    if (referenceId) {
      const exists = rows.slice(1).some((r: any) => r[1] === user.uid && r[2] === action && r[4] === String(referenceId));
      if (exists) return res.json({ success: true, alreadyAwarded: true });
    }

    const newRow = [`xp-${Date.now()}`, user.uid, action, amount, referenceId || '', new Date().toISOString()];
    await appendSheetData(sheets, 'XP!A:F', [newRow]);

    return res.json({ success: true, amount });
  } catch (err: any) {
    console.error('Google Sheets Award XP Error:', err.message);
    return res.status(500).json({ error: 'Failed to award XP' });
  }
});

// -----------------------------------------------------------------------------
// PRIMARY TURSO DATABASE ENDPOINTS
// -----------------------------------------------------------------------------

// Profile
app.get('/api/turso/profile', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  try {
    const profile = await getOrCreateUserProfile(user.uid, user.name);
    return res.json({ success: true, profile });
  } catch (err: any) {
    console.error('[Turso API] Profile GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

app.post('/api/turso/profile', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const {
    username,
    avatar,
    cardTheme,
    cardNumber,
    bio,
    signatureUrl,
    memberSince,
    tier,
    proMember,
    accountData,
    lifetimeXp,
    xp,
    level,
    explicitUserId,
    userId: bodyUserId
  } = req.body;
  const targetUid = (explicitUserId && explicitUserId !== 'guest')
    ? explicitUserId
    : ((bodyUserId && bodyUserId !== 'guest') ? bodyUserId : (user?.uid || 'guest'));

  try {
    const profile = await updateTursoUserProfile({
      userId: targetUid,
      username: username || user?.name,
      avatar,
      cardTheme,
      cardNumber,
      bio,
      signatureUrl,
      memberSince,
      tier,
      proMember,
      accountData,
      lifetimeXp: lifetimeXp !== undefined ? Number(lifetimeXp) : (xp !== undefined ? Number(xp) : undefined),
      level: level !== undefined ? Number(level) : undefined
    });
    return res.json({ success: true, profile });
  } catch (err: any) {
    console.error('[Turso API] Profile POST error:', err.message);
    return res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Member Verification from Turso Database
app.get('/api/turso/member/verify', async (req, res) => {
  const queryId = (req.query.id || req.query.cardId || req.query.query || '').toString().trim();
  if (!queryId) {
    return res.status(400).json({ success: false, error: 'Query ID is required' });
  }
  try {
    const member = await lookupTursoMember(queryId);
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member account not found' });
    }
    return res.json({ success: true, member });
  } catch (err: any) {
    console.error('[Turso API] Member verify error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to verify member' });
  }
});

// Community Members Directory from Turso Database
app.get('/api/turso/members', async (req, res) => {
  try {
    const members = await getAllTursoMembers();
    return res.json({ success: true, members });
  } catch (err: any) {
    console.error('[Turso API] Members GET error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch members' });
  }
});

// XP & Levels
app.get('/api/turso/xp', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  try {
    const xpData = await getUserXp(user.uid);
    return res.json({ success: true, ...xpData });
  } catch (err: any) {
    console.error('[Turso API] XP GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch XP' });
  }
});

app.post('/api/turso/xp/award', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { action, amount, referenceId } = req.body;
  if (!action || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Action and numeric amount required' });
  }
  try {
    const result = await awardUserXp(user.uid, action, amount, referenceId);
    return res.json(result);
  } catch (err: any) {
    console.error('[Turso API] XP Award error:', err.message);
    return res.status(500).json({ error: 'Failed to award XP' });
  }
});

// -----------------------------------------------------------------------------
// LEADERBOARD ENDPOINTS (PRECOMPUTED CACHE, QUOTA EFFICIENT)
// -----------------------------------------------------------------------------
app.get('/api/leaderboard', async (req, res) => {
  try {
    const data = await getCachedLeaderboard(50);
    return res.json({
      success: true,
      leaderboard: data.leaderboard,
      computed_at: data.computed_at
    });
  } catch (err: any) {
    console.error('[Leaderboard API] Failed to fetch leaderboard:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/leaderboard/me', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const targetUid = (user?.uid && user.uid !== 'guest') ? user.uid : (req.query.userId as string);
  if (!targetUid || targetUid === 'guest') {
    return res.json({ success: false, authenticated: false });
  }

  try {
    const rankData = await getUserLeaderboardRank(targetUid);
    if (!rankData) {
      return res.json({ success: false, error: 'User not found' });
    }
    return res.json({
      success: true,
      ...rankData
    });
  } catch (err: any) {
    console.error('[Leaderboard API] Failed to fetch user rank:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch user rank' });
  }
});

// Helper to sync all real Firestore user accounts into Turso for global ranking
async function syncFirestoreUsersToTursoHelper() {
  const clientDb = getClientFirestoreInstance();
  if (!clientDb || serverQuotaExceeded) return 0;
  try {
    const snap = await getClientDocs(clientCollection(clientDb, 'users'));
    const realUsers: Array<{
      userId: string;
      username: string;
      avatarUrl?: string;
      xp?: number;
      level?: number;
      tier?: string;
      watchSeconds?: number;
      currentStreak?: number;
      streakPenalty?: number;
    }> = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      const name = data?.profile?.name || data?.name || data?.username || '';
      const lowerName = name.toLowerCase();

      // Skip fake, test, or guest accounts
      if (
        !id ||
        id === 'guest' ||
        id.startsWith('test_') ||
        id.startsWith('FK-') ||
        id === 'admin-master' ||
        id === 'usr_testgmailcom' ||
        id === 'usr_gjonigamilcom' ||
        id === 'goldprince_studio' ||
        lowerName.includes('guest') ||
        lowerName.includes('test cinephile')
      ) {
        return;
      }

      const watchSec = Number(data?.stats?.totalWatchSeconds ?? data?.totalWatchSeconds ?? 0);
      const rawStreak = Number(data?.stats?.currentStreak ?? data?.currentStreak ?? 0);
      const isStreakLost = Boolean(data?.stats?.streakLost || data?.stats?.streakBroken);
      const lastActive = data?.stats?.lastActiveDate || data?.stats?.lastLoginDate || data?.last_active_date;
      const today = new Date().toISOString().split('T')[0];
      let currentStreak = rawStreak;

      if (!lastActive) {
        currentStreak = 0;
      } else {
        const [y1, m1, d1] = String(lastActive).split('-').map(Number);
        const [y2, m2, d2] = today.split('-').map(Number);
        if (!isNaN(y1) && !isNaN(m1) && !isNaN(d1)) {
          const utc1 = Date.UTC(y1, m1 - 1, d1);
          const utc2 = Date.UTC(y2, m2 - 1, d2);
          const diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
          // If inactive for more than 24h (> 1 calendar day), streak is reset to 0
          if (diffDays > 1) {
            currentStreak = 0;
          }
        }
      }

      realUsers.push({
        userId: id,
        username: name || 'Cinema Member',
        avatarUrl: data?.profile?.avatarUrl || data?.avatarUrl || '',
        xp: Number(data?.lifetimeXp ?? data?.xp ?? 0),
        level: Number(data?.currentLevel ?? data?.level ?? 1),
        tier: data?.profile?.tier || 'BRONZE',
        watchSeconds: watchSec,
        currentStreak: currentStreak,
        streakPenalty: isStreakLost ? 500 : 0
      });
    });

    if (realUsers.length > 0) {
      return await syncExternalRealUsersToTurso(realUsers);
    }
  } catch (err: any) {
    console.warn('[Leaderboard Sync] Firestore sync warn:', err.message);
  }
  return 0;
}

app.post('/api/leaderboard/refresh', async (req, res) => {
  try {
    // 1. Sync real users from Firestore into Turso first
    await syncFirestoreUsersToTursoHelper();
    // 2. Recompute the leaderboard cache with strict real-user ranking
    const result = await refreshLeaderboardCache();
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Leaderboard API] Manual refresh error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to refresh leaderboard' });
  }
});

app.post('/api/turso/referral/process', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { refCode, email, deviceFingerprint, userId: bodyUserId } = req.body;
  const refereeUserId = bodyUserId || user?.uid;
  if (!refereeUserId || !refCode) {
    return res.status(400).json({ error: 'Missing refereeUserId or refCode' });
  }
  try {
    const result = await processReferralSignup({
      refereeUserId,
      refCode,
      email: email || user?.email,
      deviceFingerprint
    });
    return res.json(result);
  } catch (err: any) {
    console.error('[Turso API] Referral process error:', err.message);
    return res.status(500).json({ error: 'Failed to process referral signup' });
  }
});

// Daily Catalog Facts Aggregate
app.get('/api/catalog-facts', async (req, res) => {
  try {
    const stats = await getTopCatalogStats();
    return res.json({ success: true, ...stats });
  } catch (err: any) {
    console.warn('[API] /api/catalog-facts error:', err?.message || err);
    return res.json({ success: true, mostLiked: null, mostCommented: null, mostWatched: null });
  }
});

// Likes
app.get('/api/turso/likes', async (req, res) => {
  const { contentId, userId } = req.query;
  if (!contentId || typeof contentId !== 'string') {
    return res.status(400).json({ error: 'Content ID required' });
  }
  try {
    const data = await getContentLikes(contentId, userId ? String(userId) : undefined);
    return res.json({ success: true, ...data });
  } catch (err: any) {
    console.error('[Turso API] Likes GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

app.get('/api/turso/likes/user', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  try {
    const likes = await getUserLikedContentIds(user.uid);
    return res.json({ success: true, likes });
  } catch (err: any) {
    console.error('[Turso API] User Likes GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch user likes' });
  }
});

app.post('/api/turso/likes/toggle', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { contentId } = req.body;
  if (!contentId) return res.status(400).json({ error: 'Content ID required' });
  try {
    const result = await toggleLike(String(contentId), user.uid);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Turso API] Likes Toggle error:', err.message);
    return res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Comments
app.get('/api/turso/comments', async (req, res) => {
  const { contentId, since, limit, offset, userId } = req.query;
  if (!contentId || typeof contentId !== 'string') {
    return res.status(400).json({ error: 'Content ID required' });
  }

  // Extract requesting user ID if provided or via Bearer token
  let requestingUserId = typeof userId === 'string' ? userId : '';
  const authHeader = req.headers.authorization;
  if (!requestingUserId && authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await getAuth().verifyIdToken(token);
      requestingUserId = decoded.uid;
    } catch {}
  }

  try {
    const comments = await getCommentsForContent(
      contentId,
      requestingUserId || undefined,
      since ? String(since) : undefined,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0
    );
    return res.json({ success: true, comments });
  } catch (err: any) {
    console.error('[Turso API] Comments GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

app.post('/api/turso/comments/add', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { contentId, text, username, avatar, parentCommentId, parent_comment_id } = req.body;
  if (!contentId || !text) return res.status(400).json({ error: 'Content ID and text required' });
  try {
    const parentId = parentCommentId || parent_comment_id || null;
    const comment = await createComment(
      String(contentId),
      user.uid,
      username || user.name || 'Cinema Member',
      avatar || 'https://api.dicebear.com/7.x/open-peeps/svg?seed=FarukatViewer',
      String(text),
      parentId ? String(parentId) : null
    );
    return res.json({ success: true, comment });
  } catch (err: any) {
    console.error('[Turso API] Comment Add error:', err.message);
    return res.status(500).json({ error: 'Failed to post comment' });
  }
});

app.post('/api/turso/comments/delete', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { commentId } = req.body;
  if (!commentId) return res.status(400).json({ error: 'Comment ID required' });
  try {
    const deleted = await deleteComment(String(commentId), user.uid);
    return res.json({ success: deleted });
  } catch (err: any) {
    console.error('[Turso API] Comment Delete error:', err.message);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Toggle Comment Like (with per-user Turso tracking)
app.post('/api/turso/comments/like/toggle', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { commentId } = req.body;
  if (!commentId || typeof commentId !== 'string') {
    return res.status(400).json({ error: 'Comment ID required' });
  }
  try {
    const result = await toggleCommentLike(commentId, user.uid);
    return res.json(result);
  } catch (err: any) {
    console.error('[Turso API] Comment Like Toggle error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to toggle comment like' });
  }
});

// Get Comment Likes
app.get('/api/turso/comments/likes', async (req, res) => {
  const { commentId, userId } = req.query;
  if (!commentId || typeof commentId !== 'string') {
    return res.status(400).json({ error: 'Comment ID required' });
  }
  try {
    const result = await getCommentLikes(commentId, typeof userId === 'string' ? userId : undefined);
    return res.json(result);
  } catch (err: any) {
    console.error('[Turso API] Comment Likes GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch comment likes' });
  }
});

// In-App Notification Center Endpoints
app.get('/api/turso/notifications', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const uid = (typeof req.query.userId === 'string' && req.query.userId.trim()) ? req.query.userId.trim() : (user?.uid || '');

  if (!uid || uid === 'guest') {
    return res.json({ success: true, notifications: [], unreadCount: 0 });
  }

  const limit = req.query.limit ? Math.min(100, Number(req.query.limit)) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  try {
    const data = await getInAppNotifications(uid, limit, offset);
    return res.json({ success: true, ...data });
  } catch (err: any) {
    console.warn('[Turso API] Notifications GET notice:', err.message);
    return res.json({ success: true, notifications: [], unreadCount: 0 });
  }
});

app.post('/api/turso/notifications/create', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const senderUid = user?.uid || '';

  const { userId, category, type, priority, title, message, targetType, targetId, actionPayload, groupKey, imageUrl } = req.body;
  const targetUserId = userId || senderUid;
  if (!targetUserId || !title || !message) {
    return res.status(400).json({ error: 'targetUserId, title and message required' });
  }

  try {
    const result = await createInAppNotificationRecord({
      userId: String(targetUserId),
      category: category || 'system',
      type: type || 'general',
      priority: priority || 'NORMAL',
      title: String(title),
      message: String(message),
      targetType: targetType || 'none',
      targetId: String(targetId || ''),
      actionPayload: actionPayload || {},
      groupKey: groupKey ? String(groupKey) : null,
      imageUrl: imageUrl ? String(imageUrl) : null
    });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Turso API] Notifications CREATE error:', err.message);
    return res.status(500).json({ error: 'Failed to create notification' });
  }
});

app.post('/api/turso/notifications/mark-read', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const uid = (typeof req.body.userId === 'string' && req.body.userId) ? req.body.userId : (user?.uid || '');

  if (!uid || uid === 'guest') return res.status(401).json({ error: 'Authentication or userId required' });

  const { notificationId, markAll } = req.body;

  try {
    const result = await markNotificationRead(notificationId, uid, Boolean(markAll));
    return res.json(result);
  } catch (err: any) {
    console.error('[Turso API] Notifications MARK-READ error:', err.message);
    return res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

app.post('/api/turso/notifications/delete', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const uid = (typeof req.body.userId === 'string' && req.body.userId) ? req.body.userId : (user?.uid || '');

  if (!uid || uid === 'guest') return res.status(401).json({ error: 'Authentication or userId required' });

  const { notificationId } = req.body;
  if (!notificationId) return res.status(400).json({ error: 'notificationId required' });

  try {
    const result = await deleteInAppNotification(String(notificationId), uid);
    return res.json(result);
  } catch (err: any) {
    console.error('[Turso API] Notifications DELETE error:', err.message);
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Watch Progress & Rewards
app.post('/api/turso/watch-progress/sync', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { contentId, progressSeconds, durationSeconds, completed } = req.body;
  if (!contentId) return res.status(400).json({ error: 'Content ID required' });
  try {
    const result = await updateWatchProgress(
      user.uid,
      String(contentId),
      Number(progressSeconds || 0),
      Number(durationSeconds || 0),
      Boolean(completed)
    );
    return res.json(result);
  } catch (err: any) {
    console.error('[Turso API] Watch Progress Sync error:', err.message);
    return res.status(500).json({ error: 'Failed to sync watch progress' });
  }
});

app.get('/api/turso/watch-progress/list', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  try {
    const list = await getUserWatchProgressList(user.uid);
    return res.json({ success: true, list });
  } catch (err: any) {
    console.error('[Turso API] Get Watch Progress List error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to get watch progress list' });
  }
});

app.post('/api/turso/watch-progress/clear', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  try {
    const result = await clearUserWatchProgress(user.uid);
    return res.json(result);
  } catch (err: any) {
    console.error('[Turso API] Clear Watch Progress error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to clear watch progress' });
  }
});

app.post('/api/turso/watch-rewards/claim', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { contentId, milestone } = req.body;
  if (!contentId || !milestone) return res.status(400).json({ error: 'Content ID and milestone required' });
  try {
    const result = await claimWatchReward(user.uid, String(contentId), String(milestone));
    return res.json(result);
  } catch (err: any) {
    console.error('[Turso API] Watch Reward Claim error:', err.message);
    return res.status(500).json({ error: 'Failed to claim reward' });
  }
});

app.post('/api/turso/streak/sync', async (req, res) => {
  const authHeader = req.headers.authorization;
  let uid = 'guest';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await getAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch (_authErr) {}
  }
  const { clientDate, userId: bodyUserId } = req.body || {};
  const targetUid = (bodyUserId && bodyUserId !== 'guest') ? bodyUserId : uid;
  try {
    const result = await syncTursoUserStreak({
      userId: targetUid,
      clientDate
    });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Turso API] Streak sync error:', err.message);
    return res.status(500).json({ error: 'Failed to sync streak' });
  }
});

// -----------------------------------------------------------------------------
// ACHIEVEMENTS & TIERS & WEEKLY CHALLENGES ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/turso/achievements', async (req, res) => {
  const authHeader = req.headers.authorization;
  let uid = 'guest';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await getAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch (_authErr) {}
  }
  const targetUid = String(req.query.userId || uid);
  try {
    const list = await getTursoAchievements(targetUid);
    return res.json({ success: true, achievements: list });
  } catch (err: any) {
    console.error('[Turso API] Achievements GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

app.post('/api/turso/achievements/unlock', async (req, res) => {
  const authHeader = req.headers.authorization;
  let uid = 'guest';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await getAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch (_authErr) {}
  }
  const { achievementKey, tier = 1, userId: bodyUserId } = req.body || {};
  const targetUid = (bodyUserId && bodyUserId !== 'guest') ? bodyUserId : uid;
  if (!achievementKey) {
    return res.status(400).json({ error: 'achievementKey is required' });
  }
  try {
    const result = await unlockTursoAchievement(targetUid, achievementKey, Number(tier));
    if (result && result.newlyUnlocked) {
      try {
        await refreshLeaderboardCache();
      } catch (err: any) {
        console.warn('[Turso API] Failed to refresh leaderboard cache on achievement unlock:', err.message);
      }
    }
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Turso API] Achievement unlock error:', err.message);
    return res.status(500).json({ error: 'Failed to unlock achievement' });
  }
});

app.get('/api/turso/tier-progress', async (req, res) => {
  const authHeader = req.headers.authorization;
  let uid = 'guest';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await getAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch (_authErr) {}
  }
  const targetUid = String(req.query.userId || uid);
  try {
    const progress = await getTursoTierProgress(targetUid);
    return res.json({ success: true, progress });
  } catch (err: any) {
    console.error('[Turso API] Tier progress GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch tier progress' });
  }
});

app.post('/api/turso/tier-progress/sync', async (req, res) => {
  const authHeader = req.headers.authorization;
  let uid = 'guest';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await getAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch (_authErr) {}
  }
  const { category, currentTier, progressValue, userId: bodyUserId } = req.body || {};
  const targetUid = (bodyUserId && bodyUserId !== 'guest') ? bodyUserId : uid;
  if (!category) {
    return res.status(400).json({ error: 'category is required' });
  }
  try {
    const success = await syncTursoTierProgress(
      targetUid,
      category,
      Number(currentTier || 1),
      Number(progressValue || 0)
    );
    return res.json({ success });
  } catch (err: any) {
    console.error('[Turso API] Tier progress sync error:', err.message);
    return res.status(500).json({ error: 'Failed to sync tier progress' });
  }
});

app.get('/api/turso/weekly-challenges', async (req, res) => {
  const authHeader = req.headers.authorization;
  let uid = 'guest';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await getAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch (_authErr) {}
  }
  const targetUid = String(req.query.userId || uid);
  const isoWeek = String(req.query.isoWeek || '');
  if (!isoWeek) {
    return res.status(400).json({ error: 'isoWeek is required' });
  }
  try {
    const challenges = await getTursoWeeklyChallenges(targetUid, isoWeek);
    return res.json({ success: true, challenges });
  } catch (err: any) {
    console.error('[Turso API] Weekly challenges GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch weekly challenges' });
  }
});

app.post('/api/turso/weekly-challenges/sync', async (req, res) => {
  const authHeader = req.headers.authorization;
  let uid = 'guest';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await getAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch (_authErr) {}
  }
  const { isoWeek, challengeTemplates, userId: bodyUserId } = req.body || {};
  const targetUid = (bodyUserId && bodyUserId !== 'guest') ? bodyUserId : uid;
  if (!isoWeek || !Array.isArray(challengeTemplates)) {
    return res.status(400).json({ error: 'isoWeek and challengeTemplates array required' });
  }
  try {
    const challenges = await initTursoWeeklyChallenges(targetUid, isoWeek, challengeTemplates);
    return res.json({ success: true, challenges });
  } catch (err: any) {
    console.error('[Turso API] Weekly challenges sync error:', err.message);
    return res.status(500).json({ error: 'Failed to sync weekly challenges' });
  }
});

app.post('/api/turso/weekly-challenges/progress', async (req, res) => {
  const authHeader = req.headers.authorization;
  let uid = 'guest';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await getAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch (_authErr) {}
  }
  const { isoWeek, challengeKey, progressDelta, absoluteProgress, userId: bodyUserId } = req.body || {};
  const targetUid = (bodyUserId && bodyUserId !== 'guest') ? bodyUserId : uid;
  if (!isoWeek || !challengeKey) {
    return res.status(400).json({ error: 'isoWeek and challengeKey required' });
  }
  try {
    const result = await updateTursoWeeklyChallengeProgress(
      targetUid,
      isoWeek,
      challengeKey,
      progressDelta,
      absoluteProgress
    );
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Turso API] Weekly challenge progress error:', err.message);
    return res.status(500).json({ error: 'Failed to update weekly challenge progress' });
  }
});

app.post('/api/turso/fcm-token', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });
  
  try {
    const { saveUserFcmToken } = await import('./src/server/tursoDb');
    await saveUserFcmToken(user.uid, token);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Turso API] FCM Token Save error:', err.message);
    return res.status(500).json({ error: 'Failed to save FCM token' });
  }
});

// Media Catalog State Endpoints (Turso DB Sync for All Users)
app.get('/api/turso/catalog', async (req, res) => {
  try {
    const state = await getTursoMediaCatalogState();
    return res.json({ success: true, ...state });
  } catch (err: any) {
    console.error('[Turso API] Catalog GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch catalog from Turso' });
  }
});

app.post('/api/turso/catalog/sync', async (req, res) => {
  try {
    const { customVideos, hiddenVideoIds, deletedVideoIds, newVideoIds, removedNewVideoIds, heroSettings, customSections } = req.body;
    const result = await saveTursoMediaCatalogState({
      customVideos,
      hiddenVideoIds,
      deletedVideoIds,
      newVideoIds,
      removedNewVideoIds,
      heroSettings,
      customSections
    });
    return res.json(result);
  } catch (err: any) {
    console.error('[Turso API] Catalog Sync error:', err.message);
    return res.status(500).json({ error: 'Failed to sync catalog to Turso' });
  }
});

// -----------------------------------------------------------------------------
// TURSO WATCH PARTY ROOM API ENDPOINTS
// -----------------------------------------------------------------------------
app.post('/api/turso/watch-party/sync', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.partyId) {
      return res.status(400).json({ error: 'partyId is required' });
    }
    const success = await syncTursoWatchPartyRoom(data);
    return res.json({ success });
  } catch (err: any) {
    console.warn('[Turso WatchParty Sync] Error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to sync party' });
  }
});

app.post('/api/turso/watch-party/playback', async (req, res) => {
  try {
    const { partyId, ...state } = req.body;
    if (!partyId) {
      return res.status(400).json({ error: 'partyId is required' });
    }
    const success = await updateTursoWatchPartyPlayback(partyId, state);
    return res.json({ success });
  } catch (err: any) {
    console.warn('[Turso WatchParty Playback] Error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to update playback' });
  }
});

app.get('/api/turso/watch-party/state', async (req, res) => {
  try {
    const partyId = String(req.query.partyId || '');
    if (!partyId) {
      return res.status(400).json({ error: 'partyId is required' });
    }
    const party = await getTursoWatchPartyRoom(partyId);
    if (!party) {
      return res.status(404).json({ error: 'Party room not found in Turso' });
    }
    return res.json(party);
  } catch (err: any) {
    console.warn('[Turso WatchParty State] Error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to fetch party state' });
  }
});

// YouTube Playlist Import Endpoint
app.get('/api/youtube/playlist', async (req, res) => {
  try {
    const playlistInput = String(req.query.playlistId || req.query.url || '').trim();
    if (!playlistInput) {
      return res.status(400).json({ error: 'Playlist ID or YouTube playlist URL is required' });
    }

    // Extract Playlist ID from URL or raw ID (e.g., list=PL... or PL...)
    let playlistId = playlistInput;
    if (playlistInput.includes('list=')) {
      const match = playlistInput.match(/list=([a-zA-Z0-9_-]+)/);
      if (match) playlistId = match[1];
    }

    playlistId = playlistId.replace(/^[^a-zA-Z0-9_-]+/, '');

    if (!playlistId) {
      return res.status(400).json({ error: 'Invalid playlist URL or ID format' });
    }

    // Fetch YouTube RSS Feed (Zero API Key required, 100% public & reliable)
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
    const feedRes = await fetch(feedUrl);
    
    if (!feedRes.ok) {
      return res.status(404).json({ error: `YouTube playlist not found or private (Status: ${feedRes.status})` });
    }

    const xmlText = await feedRes.text();
    
    // Parse playlist title
    let playlistTitle = 'YouTube Playlist';
    const titleMatch = xmlText.match(/<title>([^<]+)<\/title>/);
    if (titleMatch && titleMatch[1]) {
      playlistTitle = titleMatch[1].replace('YouTube - ', '').trim();
    }

    // Parse items (<entry>...</entry>)
    const entries = xmlText.split('<entry>');
    const items: any[] = [];

    for (let i = 1; i < entries.length; i++) {
      const entry = entries[i];
      const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const videoTitleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const mediaDescMatch = entry.match(/<media:description>([^<]*)<\/media:description>/);
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);

      if (videoIdMatch && videoIdMatch[1]) {
        const vId = videoIdMatch[1].trim();
        const rawTitle = videoTitleMatch ? videoTitleMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') : `Video ${i}`;
        const rawDesc = mediaDescMatch ? mediaDescMatch[1].trim().replace(/&amp;/g, '&') : '';
        const publishedDate = publishedMatch ? publishedMatch[1].trim() : new Date().toISOString();
        const year = publishedDate.substring(0, 4) || '2026';

        const hqThumb = `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;

        items.push({
          id: `yt_${vId}`,
          videoId: vId,
          title: rawTitle,
          description: rawDesc || `Imported video from playlist ${playlistTitle}`,
          thumbnail: hqThumb,
          poster: hqThumb,
          backdrop: hqThumb,
          videoUrl: `https://www.youtube.com/watch?v=${vId}`,
          year: year,
          duration: '10m',
          rating: '9.5',
          tags: ['YouTube', 'Playlist'],
        });
      }
    }

    return res.json({
      success: true,
      playlistId,
      playlistTitle,
      count: items.length,
      items
    });
  } catch (err: any) {
    console.error('[YouTube API] Playlist fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch YouTube playlist: ' + err.message });
  }
});

// Cloud SQL Backup Database Status & Test Endpoint
app.get('/api/cloud-sql/status', async (req, res) => {
  try {
    const db = getBackupDb();
    if (!db) {
      return res.json({
        success: false,
        configured: false,
        message: 'Cloud SQL backup database is not configured (missing SQL_HOST or environment credentials).'
      });
    }

    // Test query execution
    const result = await db.execute('SELECT NOW() as current_time');
    return res.json({
      success: true,
      configured: true,
      connected: true,
      projectId: 'balmy-hue-1cf5x',
      region: 'europe-west2',
      instance: 'ai-studio-4cea5145',
      role: 'secondary_backup_database',
      serverTime: result.rows?.[0]?.current_time || new Date().toISOString()
    });
  } catch (err: any) {
    return res.json({
      success: false,
      configured: true,
      connected: false,
      error: err?.message || 'Connection failed',
      projectId: 'balmy-hue-1cf5x',
      region: 'europe-west2',
      role: 'secondary_backup_database'
    });
  }
});

// Cloud SQL Watch Party Audit Logs
app.get('/api/cloud-sql/watch-party/audit', async (req, res) => {
  try {
    const partyId = req.query.partyId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await fetchCloudSqlAuditLogs(partyId, limit);
    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch audit logs' });
  }
});

app.post('/api/cloud-sql/watch-party/audit', async (req, res) => {
  try {
    const { partyId, eventType, userId, userName, details } = req.body;
    const success = await backupRecordToCloudSql('watch_party_audit', {
      partyId,
      eventType,
      userId,
      userName,
      details
    });
    return res.json({ success });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to save audit log' });
  }
});

// Cloud SQL Watch Party Chat Messages Archive
app.get('/api/cloud-sql/watch-party/messages/:partyId', async (req, res) => {
  try {
    const partyId = req.params.partyId;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const messages = await fetchCloudSqlMessages(partyId, limit);
    return res.json({ success: true, messages });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch chat messages' });
  }
});

app.post('/api/cloud-sql/watch-party/messages', async (req, res) => {
  try {
    const { partyId, senderId, senderName, message } = req.body;
    const success = await backupRecordToCloudSql('watch_party_messages', {
      partyId,
      senderId,
      senderName,
      message
    });
    return res.json({ success });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to archive message' });
  }
});


// -----------------------------------------------------------------------------
// SECURE BACKEND-ENFORCED ADMIN ARCHITECTURE (FIREBASE ADMIN SDK)
// -----------------------------------------------------------------------------
async function startServer() {
  // Initialize resilient Firestore Client SDK on startup
  getClientFirestoreInstance();
  // Initialize primary Turso database schema and tables
  initTursoTables().then(async () => {
    try {
      await syncFirestoreUsersToTursoHelper();
      await refreshLeaderboardCache();
    } catch (err) {
      console.warn('[Leaderboard] Startup sync and cache prime warn:', err);
    }
  }).catch(console.error);

  // Daily refresh job: scheduled to run once every 24 hours
  setInterval(async () => {
    console.log('[Leaderboard] Running scheduled 24-hour leaderboard refresh job...');
    try {
      await syncFirestoreUsersToTursoHelper();
      await refreshLeaderboardCache();
    } catch (err: any) {
      console.error('[Leaderboard] Scheduled refresh error:', err);
    }
  }, 24 * 60 * 60 * 1000);

  if (process.env.NODE_ENV !== 'production' && !process.env.NETLIFY) {
    const vitePath = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePath);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.NETLIFY) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.NETLIFY) {
    app.listen(Number(PORT) || 3000, '0.0.0.0', () => {
      console.log(`[FARUKAT SERVER] Server bound to 0.0.0.0 on port ${PORT}`);
    });
  }
}

if (!process.env.NETLIFY) {
  startServer().catch(err => {
    console.error('[FATAL ERROR] Server failed to start:', err);
    process.exit(1);
  });
}

export { app };
