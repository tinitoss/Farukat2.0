import { MediaItem, XpAccount } from '../types';
import { MEDIA_CATALOG } from '../data/mediaData';
import { parseDurationToSeconds, getVerifiedDuration } from './durationStore';
import { calculateLevelInfo } from './xpSystem';
import { getCalculatedTotalWatchSeconds } from './watchProgressManager';
import { getSagaItemsForUniverse } from './sagaManager';

export interface DailyFactItem {
  id: string;
  category: 'catalog' | 'personal' | 'community' | 'discovery';
  textEn: string;
  textSq: string;
}

export interface CatalogDbStats {
  mostLiked: { contentId: string; count: number } | null;
  mostCommented: { contentId: string; count: number } | null;
  mostWatched: { contentId: string; count: number } | null;
}

// In-memory cache for live DB stats
let cachedDbStats: CatalogDbStats | null = null;
let lastDbStatsFetch = 0;
const DB_STATS_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch top community statistics from the backend with memory and localStorage caching.
 */
export async function fetchCatalogDbStats(): Promise<CatalogDbStats> {
  const now = Date.now();
  if (cachedDbStats && now - lastDbStatsFetch < DB_STATS_TTL_MS) {
    return cachedDbStats;
  }

  // Check localStorage cache
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('farukat_catalog_db_stats_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (now - parsed.timestamp < DB_STATS_TTL_MS) {
          cachedDbStats = parsed.data;
          lastDbStatsFetch = parsed.timestamp;
          return cachedDbStats!;
        }
      }
    } catch {}
  }

  try {
    const res = await fetch('/api/catalog-facts');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        const stats: CatalogDbStats = {
          mostLiked: data.mostLiked || null,
          mostCommented: data.mostCommented || null,
          mostWatched: data.mostWatched || null
        };
        cachedDbStats = stats;
        lastDbStatsFetch = now;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(
              'farukat_catalog_db_stats_v1',
              JSON.stringify({ timestamp: now, data: stats })
            );
          } catch {}
        }
        return stats;
      }
    }
  } catch (err) {
    console.warn('[Daily Facts Engine] Failed to fetch catalog stats:', err);
  }

  return cachedDbStats || { mostLiked: null, mostCommented: null, mostWatched: null };
}

/**
 * Resolves a content ID (movie or episode) to its title.
 */
export function resolveContentTitle(contentId: string, catalog: MediaItem[] = MEDIA_CATALOG, lang: 'en' | 'sq' = 'en'): string {
  if (!contentId) return '';

  for (const m of catalog) {
    if (m.id === contentId) {
      return (lang === 'sq' && m.title_sq) ? m.title_sq : m.title;
    }
    if (m.episodes) {
      for (const ep of m.episodes) {
        if (ep.id === contentId) {
          const epTitle = (lang === 'sq' && ep.title_sq) ? ep.title_sq : ep.title;
          const parentTitle = (lang === 'sq' && m.title_sq) ? m.title_sq : m.title;
          return `${parentTitle} (${epTitle})`;
        }
      }
    }
  }

  // Fallback: format id into title case
  return contentId
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (m > 0 && s > 0) {
    return `${m}m ${s}s`;
  }
  return `${m}m`;
}

/**
 * Scans local storage for user's in-progress watch sessions.
 */
function findInProgressMovie(userId: string, catalog: MediaItem[]): { title: string; titleSq: string; remainingMinutes: number } | null {
  if (!userId || userId === 'guest' || typeof window === 'undefined') return null;

  try {
    const prefix = `farukat_watch_prog_${userId}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const valRaw = localStorage.getItem(key);
        if (valRaw) {
          const val = JSON.parse(valRaw);
          const currentPos = Number(val.currentPositionSeconds) || 0;
          const duration = Number(val.videoDurationSeconds) || 0;
          const completed = Boolean(val.completed);

          if (!completed && duration > 120 && currentPos > 30) {
            const percent = (currentPos / duration) * 100;
            if (percent >= 10 && percent <= 90) {
              const remainingSec = Math.max(60, duration - currentPos);
              const remainingMinutes = Math.ceil(remainingSec / 60);
              const rawTitle = val.mediaTitle || val.mediaId || '';
              const matched = catalog.find(m => m.id === val.mediaId || m.title === rawTitle);
              const title = matched ? matched.title : rawTitle;
              const titleSq = matched && matched.title_sq ? matched.title_sq : title;
              return { title, titleSq, remainingMinutes };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Daily Facts Engine] Error reading watch progress:', err);
  }

  return null;
}

/**
 * Builds all available real, verified facts from the catalog, database, and user profile.
 */
export function buildCandidateFacts(
  catalog: MediaItem[] = MEDIA_CATALOG,
  account?: XpAccount,
  dbStats?: CatalogDbStats | null,
  userId?: string
): DailyFactItem[] {
  const candidates: DailyFactItem[] = [];

  // ==========================================
  // 1. CATALOG CONTENT FACTS (Real Data Only)
  // ==========================================
  const singleMovies = catalog.filter(m => !m.isSeries);
  const seriesList = catalog.filter(m => m.isSeries);

  // Total titles
  candidates.push({
    id: 'catalog_total_titles',
    category: 'catalog',
    textEn: `FARUKAT currently features ${singleMovies.length} movies and ${seriesList.length} series ready to stream.`,
    textSq: `FARUKAT aktualisht përmban ${singleMovies.length} filma dhe ${seriesList.length} seri të gatshme për transmetim.`
  });

  // Behind the Scenes count
  const btsItems = catalog.filter(
    m => m.category === 'behind' || m.originalSection === 'behind-scenes' || m.title.toLowerCase().includes('behind')
  );
  if (btsItems.length > 0) {
    candidates.push({
      id: 'catalog_bts_count',
      category: 'catalog',
      textEn: `Explore ${btsItems.length} exclusive behind-the-scenes films showcasing how the productions were made.`,
      textSq: `Eksploroni ${btsItems.length} filma ekskluzivë prapaskenash që tregojnë se si u realizuan produksionet.`
    });
  }

  // Longest & Shortest movie (with verified runtime)
  const moviesWithRuntime = singleMovies
    .map(m => {
      const verified = getVerifiedDuration(m.id, m.duration);
      const secs = parseDurationToSeconds(verified);
      return { ...m, verifiedSecs: secs };
    })
    .filter(m => m.verifiedSecs > 60);

  if (moviesWithRuntime.length > 0) {
    moviesWithRuntime.sort((a, b) => b.verifiedSecs - a.verifiedSecs);
    const longest = moviesWithRuntime[0];
    const shortest = moviesWithRuntime[moviesWithRuntime.length - 1];

    candidates.push({
      id: 'catalog_longest_movie',
      category: 'catalog',
      textEn: `FARUKAT's longest film is ${longest.title}, with a verified runtime of ${formatDuration(longest.verifiedSecs)}.`,
      textSq: `Filmi më i gjatë në FARUKAT është ${longest.title_sq || longest.title}, me kohëzgjatje të verifikuar ${formatDuration(longest.verifiedSecs)}.`
    });

    candidates.push({
      id: 'catalog_shortest_movie',
      category: 'catalog',
      textEn: `Looking for a quick watch? ${shortest.title} is the shortest film in the catalog at ${formatDuration(shortest.verifiedSecs)}.`,
      textSq: `Kërkoni një film të shpejtë? ${shortest.title_sq || shortest.title} është filmi më i shkurtër në katalog me ${formatDuration(shortest.verifiedSecs)}.`
    });

    // Total Catalog Runtime & Average Runtime
    const totalRuntimeSec = moviesWithRuntime.reduce((acc, curr) => acc + curr.verifiedSecs, 0);
    const totalHours = Math.round(totalRuntimeSec / 3600);
    const avgMins = Math.round(totalRuntimeSec / moviesWithRuntime.length / 60);

    if (totalHours > 10) {
      candidates.push({
        id: 'catalog_total_runtime',
        category: 'catalog',
        textEn: `The complete FARUKAT movie catalog spans over ${totalHours} hours of continuous cinematic entertainment.`,
        textSq: `I gjithë katalogu i filmave në FARUKAT përmban mbi ${totalHours} orë transmetim kinematografik të pandërprerë.`
      });
    }

    if (avgMins > 0) {
      candidates.push({
        id: 'catalog_avg_runtime',
        category: 'catalog',
        textEn: `The average film runtime across FARUKAT is approximately ${avgMins} minutes.`,
        textSq: `Kohëzgjatja mesatare e një filmi në FARUKAT është afërsisht ${avgMins} minuta.`
      });
    }
  }

  // Oldest & Newest release
  const withValidYear = catalog
    .filter(m => /^\d{4}$/.test(m.year))
    .map(m => ({ ...m, yearNum: parseInt(m.year, 10) }))
    .sort((a, b) => a.yearNum - b.yearNum);

  if (withValidYear.length > 0) {
    const oldest = withValidYear[0];
    const newest = withValidYear[withValidYear.length - 1];

    candidates.push({
      id: 'catalog_oldest_release',
      category: 'catalog',
      textEn: `${oldest.title} from ${oldest.year} is the earliest production preserved in the FARUKAT vault.`,
      textSq: `${oldest.title_sq || oldest.title} nga viti ${oldest.year} është produksioni më i hershëm i ruajtur në FARUKAT.`
    });

    candidates.push({
      id: 'catalog_newest_release',
      category: 'catalog',
      textEn: `${newest.title} (${newest.year}) is the newest major release currently streaming on FARUKAT.`,
      textSq: `${newest.title_sq || newest.title} (${newest.year}) është publikimi më i ri kryesor që transmetohet në FARUKAT.`
    });
  }

  // ==========================================
  // 2. SAGA & DISCOVERY FACTS
  // ==========================================
  // Dardi: Troll first movie
  const trollMovie = catalog.find(m => m.id === 'dardi-troll');
  if (trollMovie) {
    candidates.push({
      id: 'discovery_dardi_troll',
      category: 'discovery',
      textEn: `Take a look at how it all started in the first-ever Dardi movie: DARDI-Troll.`,
      textSq: `Shikoni se si filloi e gjitha në filmin e parë të Dardit: DARDI-Troll.`
    });
  }

  // Ladi: Forca lore
  const forcaMovie = catalog.find(m => m.id === 'ladi-forca');
  if (forcaMovie) {
    candidates.push({
      id: 'discovery_ladi_forca',
      category: 'discovery',
      textEn: `How was it long before Ladi met Dardi? Watch it yourself in Ladi-Forca.`,
      textSq: `Si ishte jeta shumë para se Ladi të takonte Dardin? Shiheni vetë te Ladi-Forca.`
    });
  }

  // Sci-Fi Universe
  const scifiItems = getSagaItemsForUniverse('scifi-saga', catalog);
  if (scifiItems.length > 0) {
    candidates.push({
      id: 'discovery_scifi_universe',
      category: 'discovery',
      textEn: `The Sci-Fi Universe features ${scifiItems.length} interconnected films chronicling the FARUKAT timeline.`,
      textSq: `Universi Sci-Fi përmban ${scifiItems.length} filma të ndërlidhur që rrëfejnë kronologjinë e FARUKAT.`
    });
  }

  // ==========================================
  // 3. COMMUNITY DATABASE FACTS (Real from DB)
  // ==========================================
  if (dbStats) {
    if (dbStats.mostLiked && dbStats.mostLiked.count > 0) {
      const titleEn = resolveContentTitle(dbStats.mostLiked.contentId, catalog, 'en');
      const titleSq = resolveContentTitle(dbStats.mostLiked.contentId, catalog, 'sq');
      candidates.push({
        id: 'community_most_liked',
        category: 'community',
        textEn: `Community favorite: ${titleEn} is the most liked title on FARUKAT with ${dbStats.mostLiked.count} likes.`,
        textSq: `I preferuari i komunitetit: ${titleSq} është titulli më i pëlqyer në FARUKAT me ${dbStats.mostLiked.count} pëlqime.`
      });
    }

    if (dbStats.mostCommented && dbStats.mostCommented.count > 0) {
      const titleEn = resolveContentTitle(dbStats.mostCommented.contentId, catalog, 'en');
      const titleSq = resolveContentTitle(dbStats.mostCommented.contentId, catalog, 'sq');
      candidates.push({
        id: 'community_most_commented',
        category: 'community',
        textEn: `Most discussed: ${titleEn} leads community conversations with ${dbStats.mostCommented.count} comments.`,
        textSq: `Më i diskutuari: ${titleSq} kryeson bisedat e komunitetit me ${dbStats.mostCommented.count} komente.`
      });
    }

    if (dbStats.mostWatched && dbStats.mostWatched.count > 0) {
      const titleEn = resolveContentTitle(dbStats.mostWatched.contentId, catalog, 'en');
      const titleSq = resolveContentTitle(dbStats.mostWatched.contentId, catalog, 'sq');
      candidates.push({
        id: 'community_most_watched',
        category: 'community',
        textEn: `Top streamed: ${titleEn} has recorded the highest community screenings on the platform.`,
        textSq: `Më i shikuari: ${titleSq} ka regjistruar numrin më të madh të shfaqjeve nga komuniteti.`
      });
    }
  }

  // ==========================================
  // 4. PERSONAL FACTS (Only when data exists)
  // ==========================================
  if (account) {
    const lifetimeXp = account.lifetimeXp || 0;
    const levelInfo = calculateLevelInfo(lifetimeXp);
    const targetNextLevel = levelInfo.level + 1;
    const remainingXp = levelInfo.xpNeededForNext;

    if (remainingXp > 0) {
      candidates.push({
        id: 'personal_level_xp',
        category: 'personal',
        textEn: `You are ${remainingXp} XP away from advancing to Level ${targetNextLevel}.`,
        textSq: `Ju jeni ${remainingXp} XP larg nga arritja e Nivelit ${targetNextLevel}.`
      });
    }

    // Titles watched
    const titlesWatched = account.stats?.titlesWatched || [];
    if (titlesWatched.length > 0) {
      candidates.push({
        id: 'personal_titles_watched',
        category: 'personal',
        textEn: `You have completed ${titlesWatched.length} title${titlesWatched.length > 1 ? 's' : ''} from the FARUKAT catalog.`,
        textSq: `Keni shikuar ${titlesWatched.length} titull${titlesWatched.length > 1 ? 'e' : ''} nga katalogu i FARUKAT.`
      });
    }

    // Watch time
    const totalSecs = (account.stats?.totalWatchSeconds || 0) || (userId ? getCalculatedTotalWatchSeconds(userId) : 0);
    if (totalSecs >= 300) {
      const formatted = formatDuration(totalSecs);
      candidates.push({
        id: 'personal_total_watch_time',
        category: 'personal',
        textEn: `You have logged ${formatted} of watch time across FARUKAT so far.`,
        textSq: `Deri më tani keni kaluar ${formatted} kohë shikimi në FARUKAT.`
      });
    }

    // Daily streak
    const currentStreak = account.stats?.currentStreak || 0;
    if (currentStreak >= 2) {
      candidates.push({
        id: 'personal_watch_streak',
        category: 'personal',
        textEn: `You are on a ${currentStreak}-day active watch streak! Keep watching today to preserve it.`,
        textSq: `Jeni në një seri aktive shikimi prej ${currentStreak} ditësh! Shikoni sot për ta ruajtur.`
      });
    }

    // Achievements
    const unlockedAchievements = account.unlockedAchievements || [];
    if (unlockedAchievements.length > 0) {
      candidates.push({
        id: 'personal_unlocked_achievements',
        category: 'personal',
        textEn: `You have unlocked ${unlockedAchievements.length} cinema achievement${unlockedAchievements.length > 1 ? 's' : ''} on your member dossier.`,
        textSq: `Keni zhbllokuar ${unlockedAchievements.length} arritje kinematografike në dosjen tuaj të anëtarit.`
      });
    }

    // In-progress movie continuation
    if (userId) {
      const inProgress = findInProgressMovie(userId, catalog);
      if (inProgress) {
        candidates.push({
          id: 'personal_in_progress',
          category: 'personal',
          textEn: `You didn't finish ${inProgress.title} — why not finish it? Only ${inProgress.remainingMinutes} minute${inProgress.remainingMinutes > 1 ? 's' : ''} left.`,
          textSq: `Nuk e keni përfunduar ${inProgress.titleSq} — pse të mos e përfundoni? Kanë mbetur vetëm ${inProgress.remainingMinutes} minut${inProgress.remainingMinutes > 1 ? 'a' : 'ë'}.`
        });
      }
    }

    // Saga progress (Banesa)
    const banesaItems = getSagaItemsForUniverse('banesa', catalog);
    if (banesaItems.length > 0 && titlesWatched.length > 0) {
      const banesaWatched = banesaItems.filter(b => titlesWatched.includes(b.id)).length;
      if (banesaWatched > 0 && banesaWatched < banesaItems.length) {
        const left = banesaItems.length - banesaWatched;
        candidates.push({
          id: 'personal_banesa_progress',
          category: 'personal',
          textEn: `You have watched ${banesaWatched} movies from Banesa Saga, with ${left} movies left to complete it.`,
          textSq: `Keni parë ${banesaWatched} filma nga Saga Banesa, kanë mbetur edhe ${left} filma për ta përfunduar.`
        });
      }
    }
  }

  return candidates;
}

/**
 * Returns a deterministic date key string (YYYY-MM-DD) for 24h rotation.
 */
function getTodayDateKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Deterministic pseudo-random number generator for stable daily selections.
 */
function seededRandom(seedStr: string): () => number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  return function () {
    hash = Math.imul(hash ^ (hash >>> 15), 0x5a7c3b29);
    hash = Math.imul(hash ^ (hash >>> 13), 0x3c6ef35f);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
  };
}

/**
 * Selects 3 balanced, non-repeating daily facts rotated every 24 hours.
 */
export function selectDailyFacts(
  catalog: MediaItem[] = MEDIA_CATALOG,
  account?: XpAccount,
  dbStats?: CatalogDbStats | null,
  userId?: string,
  lang: 'en' | 'sq' = 'en'
): string[] {
  const allCandidates = buildCandidateFacts(catalog, account, dbStats, userId);
  if (allCandidates.length === 0) return [];

  const dateKey = getTodayDateKey();
  const storageKey = `farukat_daily_facts_v3_${userId || 'guest'}`;

  let selectedIds: string[] = [];
  let recentHistory: string[] = [];

  // Check if today's selection is already stored
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.dateKey === dateKey && Array.isArray(parsed.selectedIds) && parsed.selectedIds.length === 3) {
          // Verify that all stored IDs still exist in candidate pool
          const validIds = parsed.selectedIds.filter((id: string) => allCandidates.some(c => c.id === id));
          if (validIds.length === 3) {
            selectedIds = validIds;
          }
        }
        if (Array.isArray(parsed.history)) {
          recentHistory = parsed.history;
        }
      }
    } catch {}
  }

  // If not selected for today, perform deterministic balanced selection
  if (selectedIds.length < 3) {
    const seed = `${dateKey}_${userId || 'guest'}`;
    const rng = seededRandom(seed);

    // Group candidates by category
    const catalogPool = allCandidates.filter(c => c.category === 'catalog');
    const personalPool = allCandidates.filter(c => c.category === 'personal');
    const discoveryPool = allCandidates.filter(c => c.category === 'discovery' || c.category === 'community');

    // Helper to pick candidate avoiding recent history if possible
    const pickOne = (pool: DailyFactItem[], excludedIds: Set<string>): DailyFactItem | null => {
      const available = pool.filter(c => !excludedIds.has(c.id));
      if (available.length === 0) return null;

      // Prefer ones not in recentHistory
      const fresh = available.filter(c => !recentHistory.includes(c.id));
      const targetPool = fresh.length > 0 ? fresh : available;
      const index = Math.floor(rng() * targetPool.length);
      return targetPool[index];
    };

    const chosenSet = new Set<string>();

    // 1. Pick 1 Catalog content fact
    const fact1 = pickOne(catalogPool, chosenSet);
    if (fact1) chosenSet.add(fact1.id);

    // 2. Pick 1 Personal fact (or discovery if no personal facts exist)
    const fact2 = pickOne(personalPool.length > 0 ? personalPool : discoveryPool, chosenSet);
    if (fact2) chosenSet.add(fact2.id);

    // 3. Pick 1 Community or Discovery fact (or fallback to catalog)
    const fact3 = pickOne(discoveryPool, chosenSet) || pickOne(catalogPool, chosenSet);
    if (fact3) chosenSet.add(fact3.id);

    // Fill up to 3 if needed
    for (const c of allCandidates) {
      if (chosenSet.size >= 3) break;
      chosenSet.add(c.id);
    }

    selectedIds = Array.from(chosenSet);

    // Update localStorage
    if (typeof window !== 'undefined') {
      try {
        const newHistory = Array.from(new Set([...selectedIds, ...recentHistory])).slice(0, 15);
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            dateKey,
            selectedIds,
            history: newHistory
          })
        );
      } catch {}
    }
  }

  // Map selected IDs to localized text strings
  const results: string[] = [];
  for (const id of selectedIds) {
    const item = allCandidates.find(c => c.id === id);
    if (item) {
      results.push(lang === 'sq' ? item.textSq : item.textEn);
    }
  }

  return results;
}

/**
 * Backward compatibility helper
 */
export function generateDailyFacts(catalog: MediaItem[] = MEDIA_CATALOG, account?: XpAccount): string[] {
  return selectDailyFacts(catalog, account, null, account?.userId, 'en');
}

