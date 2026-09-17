/**
 * YouTube Saga Duration Calculator
 * 
 * Fetches exact, real-time video durations from the YouTube Data API v3.
 * Strictly uses contentDetails.duration (ISO 8601) with zero guesswork.
 * 
 * Usage:
 *   1. Supply your YOUTUBE_API_KEY below or via environment variable:
 *      export YOUTUBE_API_KEY="your_api_key_here"
 *   2. Run with Node.js:
 *      node scripts/youtube-duration-calculator.js
 *   Or paste into a browser developer console.
 */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'YOUR_YOUTUBE_API_KEY_HERE';

// ==========================================
// 1. INPUT VIDEO URLS
// ==========================================

// Videos from "The End" Saga
const THE_END_SAGA_URLS = [
  'https://www.youtube.com/watch?v=wFB3buLcIFs', // The Part One
  'https://www.youtube.com/watch?v=XwhzYH4mENc', // The Part Two
  'https://www.youtube.com/watch?v=ostAVFmQHDg', // The Part Three
  'https://www.youtube.com/watch?v=X8dA4MnfklU', // DARDI-THE END OF YEAR
];

// Videos from "Banesa" Saga
const BANESA_SAGA_URLS = [
  'https://www.youtube.com/watch?v=dMTxjgluvBg', // The HEATERS - Episodi 1
  'https://www.youtube.com/watch?v=lIEAbbGPA-U', // The HEATERS - Episodi 2
  'https://www.youtube.com/watch?v=o4yf3cZeZXQ', // The HATERS - Episodi 3
  'https://www.youtube.com/watch?v=OtGEwlEdovI', // The HEATERS - Episodi 4
  'https://www.youtube.com/watch?v=PoSfCS5V5uU', // The HEATERS - Episodi 5
  'https://www.youtube.com/watch?v=Y2tN7NhMIE0', // The HATERS - Episodi 6
  'https://www.youtube.com/watch?v=cc4kISAqRMo', // The HATERS - Episodi 7
  'https://www.youtube.com/watch?v=BGTpOWAOEKM', // The HATERS - Episodi 8
  'https://www.youtube.com/watch?v=B3kFAgp54qI', // Fundi I The Heaters
  'https://www.youtube.com/watch?v=OR5p3HR8YGE', // DARDI - Troll
  'https://www.youtube.com/watch?v=pDGvXk_kdZU', // DARDI - It's BACK
  'https://www.youtube.com/watch?v=NOinkEXsNq8', // DARDI: 1-YEAR
  'https://www.youtube.com/watch?v=X8dA4MnfklU', // DARDI - THE END OF YEAR
  'https://www.youtube.com/watch?v=xtxYDk_i7sM', // Dardi & Yllza - LOSS
  'https://www.youtube.com/watch?v=jXJIYyt0QyM', // Dardi & Baca Bush - PAUSE
  'https://www.youtube.com/watch?v=Ffv0zD1iIRQ', // Dardi - Love
  'https://www.youtube.com/watch?v=Kw2Ae5AwD94', // Ladi - Forca
  'https://www.youtube.com/watch?v=6v26hjIxuLM', // Dardi & Ladi - Fillimi
  'https://www.youtube.com/watch?v=guEnb_h1JRY', // 3-Mangupat EP.1
  'https://www.youtube.com/watch?v=qWyI6Pt5JQo', // 3-Mangupat EP.2
  'https://www.youtube.com/watch?v=zdklSBYf-XY', // 3-Mangupat EP.3
  'https://www.youtube.com/watch?v=Miga8FDFjhA', // Dardi & Ladi - Në aventurë
  'https://www.youtube.com/watch?v=pD1FBh_9mZM', // Dardi & Ladi - Një jetë e re!
  'https://www.youtube.com/watch?v=TUK6bkb33VI', // Dardi - Baca Bush: UDHËZIMET (P1)
  'https://www.youtube.com/watch?v=BjMkwzdcyKM', // Dardi - Baca Bushë: UDHËZIMET (P2)
  'https://www.youtube.com/watch?v=u1xFZKTWs4s', // Dardi - Ladi: SUKSES
  'https://www.youtube.com/watch?v=279NomDzT_E', // Men’s World
  'https://www.youtube.com/watch?v=XevXuOcarHU', // Dardi - Ladi: Different Lives
  'https://www.youtube.com/watch?v=P03nMm_7akU', // 3-Mangupat - “Tentim Puqi” - Ep.1
  'https://www.youtube.com/watch?v=VXENaUqpfAE', // 3-Mangupat - ‘’Vetëvrasja’’ Ep.2
  'https://www.youtube.com/watch?v=t2bmxK-ru7A', // Dardi & Ladi: Frika
  'https://www.youtube.com/watch?v=GwfU_D9J1ew', // Dardi & Ladi: Lufta për Dashuri
  'https://www.youtube.com/watch?v=pcnjLBnCmKc', // Dardi & Ladi: Dhandrri Vogël
  'https://www.youtube.com/watch?v=RZVUdQYvfMc', // Dardi & Ladi: Familja
];

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

/**
 * Extracts the 11-character YouTube video ID from various URL formats.
 */
function extractVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const cleaned = url.trim();

  // Matches standard watch URLs, shortlinks, embeds, shorts, etc.
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
  const match = cleaned.match(regex);
  if (match) return match[1];

  // If already a bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleaned)) return cleaned;

  return null;
}

/**
 * Parses an ISO 8601 duration string (e.g. "PT2H23M45S", "PT51M14S", "PT30S") into total seconds.
 */
function parseIso8601Duration(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;

  const regex = /P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?/;
  const matches = durationStr.match(regex);
  if (!matches) return 0;

  const days = parseInt(matches[1] || '0', 10);
  const hours = parseInt(matches[2] || '0', 10);
  const minutes = parseInt(matches[3] || '0', 10);
  const seconds = parseFloat(matches[4] || '0');

  return days * 86400 + hours * 3600 + minutes * 60 + Math.round(seconds);
}

/**
 * Formats total seconds into a readable "Xh Ym Zs" or "Ym Zs" string.
 */
function formatSecondsToHms(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

// ==========================================
// 3. CORE RUNTIME CALCULATOR (FETCH API)
// ==========================================

/**
 * Queries YouTube Data API v3 for a list of URLs and computes exact runtime.
 *
 * @param {string[]} urls - Array of YouTube URLs
 * @param {string} apiKey - Google YouTube Data API v3 Key
 * @param {string} label - Name/Label for this set of videos
 */
async function calculateYouTubeRuntimes(urls, apiKey, label = 'Videos') {
  if (!apiKey || apiKey === 'YOUR_YOUTUBE_API_KEY_HERE') {
    throw new Error('Please provide a valid YOUTUBE_API_KEY to call the YouTube Data API v3.');
  }

  console.log(`\n======================================================`);
  console.log(`Processing: ${label} (${urls.length} URLs)`);
  console.log(`======================================================`);

  const results = [];
  const flagged = [];

  // 1. Extract IDs and identify invalid URLs immediately
  const validItems = [];
  urls.forEach((url, index) => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      flagged.push({
        index: index + 1,
        url,
        error: 'INVALID_URL: Could not parse an 11-character YouTube video ID'
      });
    } else {
      validItems.push({ index: index + 1, url, videoId });
    }
  });

  // 2. Query YouTube Data API v3 in batches of up to 50 IDs (API limit per request)
  const BATCH_SIZE = 50;
  for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
    const batch = validItems.slice(i, i + BATCH_SIZE);
    const idList = batch.map((item) => item.videoId).join(',');

    // We request contentDetails (duration) and snippet (official title)
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${encodeURIComponent(idList)}&key=${encodeURIComponent(apiKey)}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        batch.forEach((b) => {
          flagged.push({
            index: b.index,
            url: b.url,
            videoId: b.videoId,
            error: `API_ERROR: ${errMsg}`
          });
        });
        continue;
      }

      const data = await response.json();
      const returnedItemsMap = new Map();
      (data.items || []).forEach((apiItem) => {
        returnedItemsMap.set(apiItem.id, apiItem);
      });

      batch.forEach((b) => {
        const apiItem = returnedItemsMap.get(b.videoId);
        if (!apiItem) {
          flagged.push({
            index: b.index,
            url: b.url,
            videoId: b.videoId,
            error: 'NOT_FOUND: Video is private, deleted, or unavailable'
          });
          return;
        }

        const isoDuration = apiItem.contentDetails?.duration;
        if (!isoDuration) {
          flagged.push({
            index: b.index,
            url: b.url,
            videoId: b.videoId,
            error: 'MISSING_DURATION: contentDetails.duration missing from API response'
          });
          return;
        }

        const durationSeconds = parseIso8601Duration(isoDuration);
        const title = apiItem.snippet?.title || `(Video ID: ${b.videoId})`;

        results.push({
          index: b.index,
          title,
          url: b.url,
          videoId: b.videoId,
          isoDuration,
          durationSeconds,
          formattedDuration: formatSecondsToHms(durationSeconds)
        });
      });
    } catch (netErr) {
      batch.forEach((b) => {
        flagged.push({
          index: b.index,
          url: b.url,
          videoId: b.videoId,
          error: `NETWORK_FAILURE: ${netErr.message}`
        });
      });
    }
  }

  // 3. Calculate Sum of Durations
  const totalSeconds = results.reduce((acc, curr) => acc + curr.durationSeconds, 0);
  const totalFormatted = formatSecondsToHms(totalSeconds);

  // 4. Output Breakdown
  console.log(`\n--- INDIVIDUAL VIDEO BREAKDOWN ---`);
  results.forEach((r) => {
    console.log(`[${r.formattedDuration.padStart(8)}] "${r.title}" (ID: ${r.videoId})`);
  });

  // 5. Output Flagged Items (if any)
  if (flagged.length > 0) {
    console.log(`\n--- FLAGGED VIDEOS (${flagged.length}) ---`);
    flagged.forEach((f) => {
      console.warn(`[FLAGGED] #${f.index} ${f.url} -> ${f.error}`);
    });
  }

  // 6. Output Final Summary
  console.log(`\n------------------------------------------------------`);
  console.log(`SUMMARY FOR ${label}:`);
  console.log(`  Valid Videos Measured : ${results.length}`);
  console.log(`  Flagged / Errored     : ${flagged.length}`);
  console.log(`  Total Raw Seconds     : ${totalSeconds}s`);
  console.log(`  TOTAL REAL RUNTIME    : ${totalFormatted}`);
  console.log(`------------------------------------------------------\n`);

  return {
    label,
    totalSeconds,
    totalFormatted,
    videoCount: results.length,
    flaggedCount: flagged.length,
    breakdown: results,
    flagged
  };
}

// ==========================================
// 4. EXECUTION RUNNER
// ==========================================

async function main() {
  console.log('Starting YouTube Saga Duration Calculator...');

  try {
    // 1. Calculate The End Saga
    const theEndReport = await calculateYouTubeRuntimes(THE_END_SAGA_URLS, YOUTUBE_API_KEY, 'The End Saga');

    // 2. Calculate Banesa Saga
    const banesaReport = await calculateYouTubeRuntimes(BANESA_SAGA_URLS, YOUTUBE_API_KEY, 'Banesa Saga');

    // 3. Combined Grand Total
    const grandTotalSeconds = theEndReport.totalSeconds + banesaReport.totalSeconds;
    console.log(`======================================================`);
    console.log(`GRAND COMBINED TOTAL (The End + Banesa Sagas):`);
    console.log(`  Total Measured Videos : ${theEndReport.videoCount + banesaReport.videoCount}`);
    console.log(`  Total Seconds         : ${grandTotalSeconds}s`);
    console.log(`  COMBINED RUNTIME      : ${formatSecondsToHms(grandTotalSeconds)}`);
    console.log(`======================================================`);
  } catch (err) {
    console.error(`Execution failed: ${err.message}`);
    console.log('\nTIP: Provide your API key by running:\n  YOUTUBE_API_KEY="AIzaSy..." node scripts/youtube-duration-calculator.js\n');
  }
}

// Export for module usage (e.g. in browser or custom scripts)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateYouTubeRuntimes,
    extractVideoId,
    parseIso8601Duration,
    formatSecondsToHms,
    THE_END_SAGA_URLS,
    BANESA_SAGA_URLS
  };
}

// Run main function directly
main();
