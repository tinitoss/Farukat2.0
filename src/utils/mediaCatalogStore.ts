import { MediaItem } from '../types';
import { MEDIA_CATALOG } from '../data/mediaData';

const CUSTOM_VIDEOS_KEY = 'farukat_custom_videos';
const HIDDEN_VIDEOS_KEY = 'farukat_hidden_video_ids';
const DELETED_VIDEOS_KEY = 'farukat_deleted_video_ids';
const NEW_VIDEOS_KEY = 'farukat_new_video_ids';
const REMOVED_NEW_VIDEOS_KEY = 'farukat_removed_new_video_ids';
const HERO_SETTINGS_KEY = 'farukat_hero_settings';
const CUSTOM_SECTIONS_KEY = 'farukat_custom_sections';
const ADMIN_SESSION_KEY = 'farukat_admin_session';

export interface SectionConfig {
  id: string;
  label: string;
  subtitle?: string;
  rank: number;
  enabled: boolean;
  badge?: string;
  variant?: 'portrait' | 'landscape';
}

export const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'series', label: 'Featured TV Series', subtitle: 'Multi-episode dramas and sagas including Dardi & Ladi, TooLate, Mahalla Kuqe, and The Heaters', rank: 0, enabled: true, badge: 'Series', variant: 'portrait' },
  { id: 'scifi', label: 'Action & Sci-Fi Universe', subtitle: 'Cinematic sci-fi movies, tournament battles, and extraterrestrial action', rank: 1, enabled: true, badge: 'Sci-Fi', variant: 'landscape' },
  { id: 'movie', label: 'Movies & Cinema', subtitle: 'Full length feature films and blockbusters', rank: 2, enabled: true, badge: 'Movies', variant: 'landscape' },
  { id: 'horror', label: 'Horror Collection', subtitle: 'Exclusive bone-chilling stories and mysterious encounters', rank: 3, enabled: true, badge: 'Horror', variant: 'landscape' },
  { id: 'skits', label: 'Funny Skits & Comedy', subtitle: 'Kosovar comedy skits featuring Selajdin, Profesori, and hilarious everyday moments', rank: 4, enabled: true, badge: 'Comedy', variant: 'landscape' },
  { id: 'behind', label: 'Behind The Scenes & VFX', subtitle: 'Exclusive looks into production, stunt work, CGI breakdowns, and how WE make a song', rank: 5, enabled: true, badge: 'Behind The Scenes', variant: 'landscape' },
  { id: 'specials', label: 'Special Features & Documentaries', subtitle: 'Biographies, memories, and director archives', rank: 6, enabled: true, badge: 'Specials', variant: 'portrait' },
  { id: 'music', label: 'Music & Soundtracks', subtitle: 'Official soundtracks, scores, and music videos', rank: 7, enabled: true, badge: 'Music', variant: 'landscape' },
];

export interface HeroCategoryConfig {
  id: string;
  label: string;
  image: string;
  tagline: string;
}

export const DEFAULT_HERO_CATEGORIES: HeroCategoryConfig[] = [
  { 
    id: 'action', 
    label: 'Action', 
    image: 'https://i.postimg.cc/Xq2qCHcP/file-000000005aa882108c8852b7dd125e92.png',
    tagline: 'High-octane adrenaline & pulse-pounding thrills.'
  },
  { 
    id: 'comedy', 
    label: 'Comedy', 
    image: 'https://i.postimg.cc/8P808pRF/file-00000000d1588210a39a984f051f51de.png',
    tagline: 'Laughter, wit, and unforgettable timing.'
  },
  { 
    id: 'horror', 
    label: 'Horror', 
    image: 'https://i.postimg.cc/7YvWvH3f/file-00000000c28482109795306293e0438f.png',
    tagline: 'Explore the shadows of the cinematic unknown.'
  },
  { 
    id: 'bts', 
    label: 'Behind the Scenes', 
    image: 'https://i.postimg.cc/8P808pRv/file-00000000b9988210afe65aa06819b300.png',
    tagline: 'The craft, the vision, and the art of production.'
  },
  { 
    id: 'sci-fi', 
    label: 'Sci-Fi', 
    image: 'https://i.postimg.cc/QxLyL8Q9/file-000000000cbc8210a5b94c19e678ea1d.png',
    tagline: 'Visions of the future and the edge of imagination.'
  }
];

const ADMIN_EMAIL = 'altinberisha434@gmail.com';

// Check if email belongs to an administrator (Strictly altinberisha434@gmail.com only)
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

// Check if currently authenticated as admin
export function isAdminSession(email?: string | null): boolean {
  if (!email) return false;
  return isAdminEmail(email);
}

// Set admin session state
export function setAdminSession(isAdmin: boolean): void {
  try {
    if (isAdmin) {
      localStorage.setItem(ADMIN_SESSION_KEY, 'true');
    } else {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  } catch (e) {
    console.warn('Failed to update admin session state:', e);
  }
}

// Password verification deprecated - admin login is strictly tied to altinberisha434@gmail.com
export function verifyAdminCredentials(password: string): boolean {
  return false;
}

// Get Custom Published Videos from Local Storage
export function getCustomVideos(): MediaItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_VIDEOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Get Hidden Video IDs
export function getHiddenVideoIds(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_VIDEOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Get Deleted Video IDs
export function getDeletedVideoIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_VIDEOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Get explicitly marked NEW Video IDs
export function getNewVideoIds(): string[] {
  try {
    const raw = localStorage.getItem(NEW_VIDEOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Get explicitly removed NEW Video IDs
export function getRemovedNewVideoIds(): string[] {
  try {
    const raw = localStorage.getItem(REMOVED_NEW_VIDEOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Save Custom Videos
export function saveCustomVideos(items: MediaItem[]): void {
  try {
    localStorage.setItem(CUSTOM_VIDEOS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save custom videos:', e);
  }
}

// Save Hidden Video IDs
export function saveHiddenVideoIds(ids: string[]): void {
  try {
    localStorage.setItem(HIDDEN_VIDEOS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to save hidden video IDs:', e);
  }
}

// Save Deleted Video IDs
export function saveDeletedVideoIds(ids: string[]): void {
  try {
    localStorage.setItem(DELETED_VIDEOS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to save deleted video IDs:', e);
  }
}

// Save New Video IDs
export function saveNewVideoIds(ids: string[]): void {
  try {
    localStorage.setItem(NEW_VIDEOS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to save new video IDs:', e);
  }
}

// Save Removed New Video IDs
export function saveRemovedNewVideoIds(ids: string[]): void {
  try {
    localStorage.setItem(REMOVED_NEW_VIDEOS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to save removed new video IDs:', e);
  }
}

/**
 * Returns the effective catalog combining base catalog + local admin additions,
 * filtering out deleted videos, applying isHidden, and adding/removing isNew badges.
 */
export function getManagedCatalog(baseCatalog: MediaItem[] = MEDIA_CATALOG, showHiddenForAdmin: boolean = false): MediaItem[] {
  const customItems = getCustomVideos();
  const hiddenIds = getHiddenVideoIds();
  const deletedIds = getDeletedVideoIds();
  const newIds = getNewVideoIds();
  const removedNewIds = getRemovedNewVideoIds();

  // Combine base catalog + custom admin items
  const combined = [...customItems, ...baseCatalog];

  // Remove duplicates by ID (custom items take precedence)
  const uniqueMap = new Map<string, MediaItem>();
  for (const item of combined) {
    if (!uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item);
    }
  }

  const result: MediaItem[] = [];

  for (const item of uniqueMap.values()) {
    // Skip deleted videos
    if (deletedIds.includes(item.id)) continue;

    const isHidden = hiddenIds.includes(item.id) || !!item.isHidden;
    
    // If video is hidden, only include if admin requested to view hidden videos
    if (isHidden && !showHiddenForAdmin) continue;

    // Determine if video has NEW badge:
    // If explicitly removed by admin -> false.
    // If explicitly added by admin or default item.isNew or year 2026 -> true.
    let isNew = false;
    if (!removedNewIds.includes(item.id)) {
      isNew = newIds.includes(item.id) || !!item.isNew || item.year === '2026';
    }

    result.push({
      ...item,
      isHidden,
      isNew,
    });
  }

  return result;
}

// Get Hero Banner Settings
export function getHeroSettings(): HeroCategoryConfig[] {
  try {
    const raw = localStorage.getItem(HERO_SETTINGS_KEY);
    if (!raw) return DEFAULT_HERO_CATEGORIES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_HERO_CATEGORIES;
  } catch {
    return DEFAULT_HERO_CATEGORIES;
  }
}

// Save Hero Banner Settings
export function saveHeroSettings(settings: HeroCategoryConfig[]): void {
  try {
    localStorage.setItem(HERO_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('farukat_catalog_updated'));
    syncCatalogToTurso().catch(() => {});
  } catch (e) {
    console.error('Failed to save hero settings:', e);
  }
}

// Get Custom Sections Config
export function getCustomSections(): SectionConfig[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SECTIONS_KEY);
    if (!raw) return DEFAULT_SECTIONS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SECTIONS;

    // Map through parsed sections, ensuring standard default sections adopt their canonical default variant if not custom-overridden
    const defaultVariantsMap = new Map(DEFAULT_SECTIONS.map(s => [s.id, s.variant]));
    const migrated = parsed.map((sec: SectionConfig) => {
      const canonicalVariant = defaultVariantsMap.get(sec.id);
      if (canonicalVariant && !sec.variant) {
        return { ...sec, variant: canonicalVariant };
      }
      return sec;
    });

    return migrated.sort((a: SectionConfig, b: SectionConfig) => (a.rank ?? 0) - (b.rank ?? 0));
  } catch {
    return DEFAULT_SECTIONS;
  }
}

// Save Custom Sections Config
export function saveCustomSections(sections: SectionConfig[]): void {
  try {
    localStorage.setItem(CUSTOM_SECTIONS_KEY, JSON.stringify(sections));
    window.dispatchEvent(new Event('farukat_catalog_updated'));
    syncCatalogToTurso().catch(() => {});
  } catch (e) {
    console.error('Failed to save custom sections:', e);
  }
}

// Admin Action: Add New Custom Section
export function adminAddSection(label: string, subtitle?: string, badge?: string, variant: 'portrait' | 'landscape' = 'portrait'): SectionConfig {
  const current = getCustomSections();
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'section';
  const id = `sec_${slug}_${Date.now().toString(36)}`;
  const maxRank = current.length > 0 ? Math.max(...current.map(s => s.rank ?? 0)) : 0;
  
  const newSection: SectionConfig = {
    id,
    label: label.trim(),
    subtitle: subtitle?.trim() || '',
    rank: maxRank + 1,
    enabled: true,
    badge: badge?.trim() || label.trim(),
    variant,
  };

  const updated = [...current, newSection].sort((a, b) => a.rank - b.rank);
  saveCustomSections(updated);
  return newSection;
}

// Admin Action: Update Section Details
export function adminUpdateSection(id: string, updates: Partial<SectionConfig>): void {
  const current = getCustomSections();
  const updated = current.map(s => {
    if (s.id === id) {
      return { ...s, ...updates };
    }
    return s;
  }).sort((a, b) => a.rank - b.rank);
  saveCustomSections(updated);
}

// Admin Action: Delete Custom Section
export function adminDeleteSection(id: string): void {
  const current = getCustomSections();
  const updated = current.filter(s => s.id !== id).map((s, idx) => ({ ...s, rank: idx }));
  saveCustomSections(updated);
}

// Admin Action: Rank/Reorder Sections
export function adminMoveSectionRank(id: string, direction: 'up' | 'down'): void {
  const current = getCustomSections().sort((a, b) => a.rank - b.rank);
  const idx = current.findIndex(s => s.id === id);
  if (idx < 0) return;

  if (direction === 'up' && idx > 0) {
    const temp = current[idx];
    current[idx] = current[idx - 1];
    current[idx - 1] = temp;
  } else if (direction === 'down' && idx < current.length - 1) {
    const temp = current[idx];
    current[idx] = current[idx + 1];
    current[idx + 1] = temp;
  }

  const reindexed = current.map((s, i) => ({ ...s, rank: i }));
  saveCustomSections(reindexed);
}

/**
 * Sync Local Media Catalog State to Turso Database
 */
export async function syncCatalogToTurso(): Promise<boolean> {
  try {
    const customVideos = getCustomVideos();
    const hiddenVideoIds = getHiddenVideoIds();
    const deletedVideoIds = getDeletedVideoIds();
    const newVideoIds = getNewVideoIds();
    const removedNewVideoIds = getRemovedNewVideoIds();
    const heroSettings = getHeroSettings();
    const customSections = getCustomSections();

    const res = await fetch('/api/turso/catalog/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customVideos,
        hiddenVideoIds,
        deletedVideoIds,
        newVideoIds,
        removedNewVideoIds,
        heroSettings,
        customSections,
      }),
    });

    if (res.ok) {
      return true;
    }
  } catch (err) {
    console.warn('[Turso Sync] Failed to push catalog state to Turso DB:', err);
  }
  return false;
}

/**
 * Fetch and Sync Media Catalog State from Turso Database
 */
export async function syncCatalogFromTurso(): Promise<boolean> {
  try {
    const res = await fetch('/api/turso/catalog');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        if (Array.isArray(data.customVideos)) saveCustomVideos(data.customVideos);
        if (Array.isArray(data.hiddenVideoIds)) saveHiddenVideoIds(data.hiddenVideoIds);
        if (Array.isArray(data.deletedVideoIds)) saveDeletedVideoIds(data.deletedVideoIds);
        if (Array.isArray(data.newVideoIds)) saveNewVideoIds(data.newVideoIds);
        if (Array.isArray(data.removedNewVideoIds)) saveRemovedNewVideoIds(data.removedNewVideoIds);
        if (Array.isArray(data.heroSettings) && data.heroSettings.length > 0) {
          localStorage.setItem(HERO_SETTINGS_KEY, JSON.stringify(data.heroSettings));
        }
        if (Array.isArray(data.customSections) && data.customSections.length > 0) {
          localStorage.setItem(CUSTOM_SECTIONS_KEY, JSON.stringify(data.customSections));
        }

        window.dispatchEvent(new Event('farukat_catalog_updated'));
        return true;
      }
    }
  } catch (err) {
    console.warn('[Turso Sync] Failed to fetch catalog state from Turso DB:', err);
  }
  return false;
}

// Automatically sync from Turso DB on initialization
if (typeof window !== 'undefined') {
  syncCatalogFromTurso().catch(() => {});
}

// Admin Action: Publish New Video or Series
export function adminPublishVideo(item: MediaItem): void {
  const custom = getCustomVideos();
  const existingIdx = custom.findIndex((c) => c.id === item.id);
  
  const newItem = {
    ...item,
    isNew: true,
  };

  if (existingIdx >= 0) {
    custom[existingIdx] = newItem;
  } else {
    custom.unshift(newItem);
  }

  saveCustomVideos(custom);

  // Mark as new
  const newIds = getNewVideoIds();
  if (!newIds.includes(item.id)) {
    newIds.push(item.id);
    saveNewVideoIds(newIds);
  }

  // Remove from explicitly removed new list if present
  const removedNew = getRemovedNewVideoIds().filter((id) => id !== item.id);
  saveRemovedNewVideoIds(removedNew);

  // Ensure it's not in deleted
  const deleted = getDeletedVideoIds().filter((id) => id !== item.id);
  saveDeletedVideoIds(deleted);

  // Dispatch custom event so UI auto-refreshes
  window.dispatchEvent(new Event('farukat_catalog_updated'));

  // Sync with Turso Database for all users
  syncCatalogToTurso().catch(() => {});
}

// Admin Action: Delete Video
export function adminDeleteVideo(id: string): void {
  const custom = getCustomVideos().filter((c) => c.id !== id);
  saveCustomVideos(custom);

  const deleted = getDeletedVideoIds();
  if (!deleted.includes(id)) {
    deleted.push(id);
    saveDeletedVideoIds(deleted);
  }

  window.dispatchEvent(new Event('farukat_catalog_updated'));

  // Sync with Turso Database for all users
  syncCatalogToTurso().catch(() => {});
}

// Admin Action: Toggle Hide/Unhide Video
export function adminToggleHideVideo(id: string): boolean {
  const hidden = getHiddenVideoIds();
  let nowHidden = false;

  if (hidden.includes(id)) {
    const updated = hidden.filter((hId) => hId !== id);
    saveHiddenVideoIds(updated);
    nowHidden = false;
  } else {
    hidden.push(id);
    saveHiddenVideoIds(hidden);
    nowHidden = true;
  }

  window.dispatchEvent(new Event('farukat_catalog_updated'));

  // Sync with Turso Database for all users
  syncCatalogToTurso().catch(() => {});

  return nowHidden;
}

// Admin Action: Toggle "NEW" badge on video
export function adminToggleNewBadge(id: string): boolean {
  const newIds = getNewVideoIds();
  const removedNewIds = getRemovedNewVideoIds();

  // Find effective item current state
  const catalog = getManagedCatalog(MEDIA_CATALOG, true);
  const targetItem = catalog.find((item) => item.id === id);
  const isCurrentlyNew = targetItem ? targetItem.isNew : false;

  let nowNew: boolean;

  if (isCurrentlyNew) {
    // Turning OFF
    saveNewVideoIds(newIds.filter((nId) => nId !== id));
    if (!removedNewIds.includes(id)) {
      removedNewIds.push(id);
      saveRemovedNewVideoIds(removedNewIds);
    }
    nowNew = false;
  } else {
    // Turning ON
    saveRemovedNewVideoIds(removedNewIds.filter((rId) => rId !== id));
    if (!newIds.includes(id)) {
      newIds.push(id);
      saveNewVideoIds(newIds);
    }
    nowNew = true;
  }

  window.dispatchEvent(new Event('farukat_catalog_updated'));

  // Sync with Turso Database for all users
  syncCatalogToTurso().catch(() => {});

  return nowNew;
}

// Admin Action: Quick change section/category for a video
export function adminUpdateVideoCategory(id: string, newCategory: any): void {
  const catalog = getManagedCatalog(MEDIA_CATALOG, true);
  const existingItem = catalog.find((item) => item.id === id);

  if (!existingItem) return;

  const updatedItem: MediaItem = {
    ...existingItem,
    category: newCategory,
    originalSection: newCategory,
  };

  const custom = getCustomVideos();
  const existingIdx = custom.findIndex((c) => c.id === id);

  if (existingIdx >= 0) {
    custom[existingIdx] = updatedItem;
  } else {
    custom.unshift(updatedItem);
  }

  saveCustomVideos(custom);

  window.dispatchEvent(new Event('farukat_catalog_updated'));
  syncCatalogToTurso().catch(() => {});
}

// Admin Action: Update Hero Banner Category Image/Tagline
export function adminUpdateHeroCategory(id: string, updates: Partial<HeroCategoryConfig>): void {
  const current = getHeroSettings();
  const updated = current.map((h) => {
    if (h.id === id) {
      return { ...h, ...updates };
    }
    return h;
  });
  saveHeroSettings(updated);
}

// Reset Catalog Overrides to Default
export function adminResetCatalog(): void {
  try {
    localStorage.removeItem(CUSTOM_VIDEOS_KEY);
    localStorage.removeItem(HIDDEN_VIDEOS_KEY);
    localStorage.removeItem(DELETED_VIDEOS_KEY);
    localStorage.removeItem(NEW_VIDEOS_KEY);
    localStorage.removeItem(REMOVED_NEW_VIDEOS_KEY);
    window.dispatchEvent(new Event('farukat_catalog_updated'));

    // Sync reset with Turso Database for all users
    syncCatalogToTurso().catch(() => {});
  } catch (e) {
    console.error('Failed to reset catalog:', e);
  }
}
