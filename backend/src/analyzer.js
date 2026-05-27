// backend/src/analyzer.js
const puppeteer = require('puppeteer');

/**
 * Core insight: Puppeteer's Coverage API returns precise byte ranges of code
 * that was actually executed/applied during page load. We use those ranges
 * directly — not DOM selector matching, not string search — to split each
 * file into USED bytes and UNUSED bytes. This is the only accurate approach.
 *
 *   entry.text          = full source of the file
 *   entry.ranges        = [{start, end}, ...] of bytes that were used
 *
 * Anything NOT in a range is unused and can be removed.
 */

// ─── COVERAGE PROCESSING ─────────────────────────────────────────────────────

/**
 * Given a file's text and its used ranges, return:
 *   usedCode    – only the bytes inside ranges (what to keep)
 *   unusedCode  – only the bytes outside ranges (what to remove)
 *   usedBytes   – count of used bytes
 *   unusedBytes – count of unused bytes
 */
// FIX: Helper to merge overlapping or nested ranges into disjoint intervals
function mergeRanges(ranges) {
  if (!ranges || ranges.length === 0) return [];
  
  // Sort ranges by start position
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlap or nested range: merge by expanding the end index
      last.end = Math.max(last.end, current.end);
    } else {
      // Disjoint range: push as new interval
      merged.push(current);
    }
  }
  return merged;
}

function splitByRanges(text, ranges) {
  if (!text || text.length === 0) {
    return { usedCode: '', unusedCode: '', usedBytes: 0, unusedBytes: text.length };
  }

  // FIX: Merge overlapping ranges first to prevent double-counting of used bytes and cursor resets
  const mergedRanges = mergeRanges(ranges);

  let usedCode = '';
  let unusedCode = '';
  let cursor = 0;

  for (const range of mergedRanges) {
    // Gap before this range = unused
    if (cursor < range.start) {
      unusedCode += text.slice(cursor, range.start);
    }
    // The range itself = used
    usedCode += text.slice(range.start, range.end);
    cursor = range.end;
  }

  // Tail after last range = unused
  if (cursor < text.length) {
    unusedCode += text.slice(cursor);
  }

  return {
    usedCode,
    unusedCode,
    usedBytes: usedCode.length,
    unusedBytes: unusedCode.length
  };
}

/**
 * Build an annotated version of the file for the code preview UI.
 * Each line is tagged as 'used' or 'unused' based on whether its
 * character positions fall inside the coverage ranges.
 *
 * Returns an array of line objects:
 *   { lineNumber, content, status: 'used'|'unused' }
 */
function buildAnnotatedLines(text, ranges) {
  if (!text) return [];

  // Build a per-character boolean array: true = used, false = unused
  const used = new Uint8Array(text.length); // 0 = unused, 1 = used
  for (const range of ranges) {
    const end = Math.min(range.end, text.length);
    for (let i = range.start; i < end; i++) {
      used[i] = 1;
    }
  }

  const lines = text.split('\n');
  const result = [];
  let charPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineEnd = charPos + line.length;

    // A line is "used" if ANY character in it was executed/applied
    let lineUsed = false;
    for (let c = charPos; c < Math.min(lineEnd, text.length); c++) {
      if (used[c] === 1) { lineUsed = true; break; }
    }

    result.push({
      lineNumber: i + 1,
      content: line,
      status: lineUsed ? 'used' : 'unused'
    });

    charPos = lineEnd + 1; // +1 for the '\n'
  }

  return result;
}

// ─── LIBRARY DETECTION (extended — covers script src + window globals) ────────

async function detectLibraries(page) {
  return await page.evaluate(() => {
    const found = [];

    const check = (condition, info) => { if (condition) found.push(info); };

    check(typeof window.jQuery !== 'undefined' || typeof window.$ === 'function', {
      key: 'jquery',
      name: 'jQuery',
      version: window.jQuery?.fn?.jquery || 'detected',
      detectedSize: 30,
      alternatives: [
        { name: 'Alpine.js',   size: '7KB',  savings: '77%', difficulty: 'Easy',        npm: 'alpinejs' },
        { name: 'Umbrella JS', size: '3KB',  savings: '90%', difficulty: 'Easy',        npm: 'umbrellajs' },
        { name: 'Vanilla JS',  size: '0KB',  savings: '100%', difficulty: 'Medium',     npm: null }
      ]
    });

    check(typeof window.bootstrap !== 'undefined', {
      key: 'bootstrap',
      name: 'Bootstrap',
      version: window.bootstrap?.Tooltip?.VERSION || 'detected',
      detectedSize: 40,
      alternatives: [
        { name: 'Tailwind CSS', size: '10KB', savings: '75%', difficulty: 'Medium',  npm: 'tailwindcss' },
        { name: 'PureCSS',      size: '4KB',  savings: '90%', difficulty: 'Easy',    npm: 'purecss' },
        { name: 'Bulma',        size: '15KB', savings: '62%', difficulty: 'Easy',    npm: 'bulma' }
      ]
    });

    check(typeof window.moment !== 'undefined', {
      key: 'moment',
      name: 'Moment.js',
      version: window.moment?.version || 'detected',
      detectedSize: 67,
      alternatives: [
        { name: 'Day.js',    size: '2KB',  savings: '97%', difficulty: 'Very Easy', npm: 'dayjs' },
        { name: 'date-fns',  size: '5KB',  savings: '93%', difficulty: 'Easy',      npm: 'date-fns' },
        { name: 'Luxon',     size: '8KB',  savings: '88%', difficulty: 'Medium',    npm: 'luxon' }
      ]
    });

    check(typeof window._ !== 'undefined' && typeof window._.map === 'function', {
      key: 'lodash',
      name: 'Lodash',
      version: window._?.VERSION || 'detected',
      detectedSize: 24,
      alternatives: [
        { name: 'Native ES6+',  size: '0KB',  savings: '100%', difficulty: 'Medium',  npm: null },
        { name: 'Lodash-es',    size: '15KB', savings: '37%',  difficulty: 'Easy',    npm: 'lodash-es' },
        { name: 'Radash',       size: '5KB',  savings: '79%',  difficulty: 'Easy',    npm: 'radash' }
      ]
    });

    check(typeof window.React !== 'undefined', {
      key: 'react',
      name: 'React',
      version: window.React?.version || 'detected',
      detectedSize: 42,
      alternatives: [
        { name: 'Preact',    size: '3KB',  savings: '93%', difficulty: 'Very Easy', npm: 'preact' },
        { name: 'Solid.js',  size: '8KB',  savings: '81%', difficulty: 'Medium',   npm: 'solid-js' }
      ]
    });

    check(typeof window.Vue !== 'undefined', {
      key: 'vue',
      name: 'Vue.js',
      version: window.Vue?.version || 'detected',
      detectedSize: 33,
      alternatives: [
        { name: 'Petite-vue', size: '6KB',  savings: '82%', difficulty: 'Easy',   npm: 'petite-vue' },
        { name: 'Alpine.js',  size: '7KB',  savings: '79%', difficulty: 'Easy',   npm: 'alpinejs' }
      ]
    });

    check(typeof window.axios !== 'undefined', {
      key: 'axios',
      name: 'Axios',
      version: window.axios?.VERSION || 'detected',
      detectedSize: 13,
      alternatives: [
        { name: 'Native fetch', size: '0KB', savings: '100%', difficulty: 'Easy', npm: null },
        { name: 'ky',           size: '4KB', savings: '69%',  difficulty: 'Easy', npm: 'ky' }
      ]
    });

    check(typeof window.gsap !== 'undefined', {
      key: 'gsap',
      name: 'GSAP',
      version: window.gsap?.version || 'detected',
      detectedSize: 60,
      alternatives: [
        { name: 'Anime.js',   size: '14KB', savings: '77%', difficulty: 'Medium',   npm: 'animejs' },
        { name: 'CSS animations', size: '0KB', savings: '100%', difficulty: 'Medium', npm: null }
      ]
    });

    check(typeof window.Swiper !== 'undefined', {
      key: 'swiper',
      name: 'Swiper',
      version: window.Swiper?.version || 'detected',
      detectedSize: 29,
      alternatives: [
        { name: 'Splide',    size: '10KB', savings: '65%', difficulty: 'Easy', npm: '@splidejs/splide' },
        { name: 'Glider.js', size: '3KB',  savings: '90%', difficulty: 'Easy', npm: 'glider-js' }
      ]
    });

    return found;
  });
}

// ─── MAIN ANALYZER ───────────────────────────────────────────────────────────

async function analyzeWebsite(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Collect all network requests so we know what was loaded
    const networkRequests = [];
    page.on('response', response => {
      networkRequests.push({
        url: response.url(),
        status: response.status(),
        contentType: response.headers()['content-type'] || ''
      });
    });

    await page.coverage.startJSCoverage();
    await page.coverage.startCSSCoverage();

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const [jsCoverage, cssCoverage] = await Promise.all([
      page.coverage.stopJSCoverage(),
      page.coverage.stopCSSCoverage()
    ]);

    const detectedLibraries = await detectLibraries(page);

    await browser.close();

    // ── Process each CSS file ──────────────────────────────────────────────
    let totalCSSBytes = 0;
    let unusedCSSBytes = 0;
    const cssFiles = [];

    for (const entry of cssCoverage) {
      const { usedCode, unusedCode, usedBytes, unusedBytes } = splitByRanges(entry.text, entry.ranges);
      const annotatedLines = buildAnnotatedLines(entry.text, entry.ranges);
      const totalBytes = entry.text.length;

      totalCSSBytes += totalBytes;
      unusedCSSBytes += unusedBytes;

      cssFiles.push({
        url: entry.url,
        totalBytes,
        usedBytes,
        unusedBytes,
        unusedPercent: totalBytes > 0 ? ((unusedBytes / totalBytes) * 100).toFixed(1) : '0.0',
        originalCode: entry.text,
        optimizedCode: usedCode,        // ← actual bytes that were applied
        removedCode: unusedCode,        // ← actual bytes that were never applied
        annotatedLines                  // ← per-line used/unused for the UI
      });
    }

    // ── Process each JS file ───────────────────────────────────────────────
    // FIX: Map to track duplicates and rename subsequent identical script URLs (such as inline scripts)
    let totalJSBytes = 0;
    let unusedJSBytes = 0;
    const jsFiles = [];
    const jsUrlSeen = {};

    for (const entry of jsCoverage) {
      const { usedCode, unusedCode, usedBytes, unusedBytes } = splitByRanges(entry.text, entry.ranges);
      const annotatedLines = buildAnnotatedLines(entry.text, entry.ranges);
      const totalBytes = entry.text.length;

      totalJSBytes += totalBytes;
      unusedJSBytes += unusedBytes;

      let finalUrl = entry.url;
      if (!jsUrlSeen[entry.url]) {
        jsUrlSeen[entry.url] = 1;
      } else {
        jsUrlSeen[entry.url]++;
        finalUrl = `${entry.url} (inline-${jsUrlSeen[entry.url] - 1})`;
      }

      jsFiles.push({
        url: finalUrl,
        totalBytes,
        usedBytes,
        unusedBytes,
        unusedPercent: totalBytes > 0 ? ((unusedBytes / totalBytes) * 100).toFixed(1) : '0.0',
        originalCode: entry.text,
        optimizedCode: usedCode,
        removedCode: unusedCode,
        annotatedLines
      });
    }

    // ── Aggregate numbers ──────────────────────────────────────────────────
    const totalBytes = totalCSSBytes + totalJSBytes;
    const unusedBytes = unusedCSSBytes + unusedJSBytes;
    const usedBytes = totalBytes - unusedBytes;

    const cssUnusedPercent = totalCSSBytes > 0 ? (unusedCSSBytes / totalCSSBytes) * 100 : 0;
    const jsUnusedPercent  = totalJSBytes  > 0 ? (unusedJSBytes  / totalJSBytes)  * 100 : 0;

    console.log(`CSS: ${totalCSSBytes} bytes total, ${unusedCSSBytes} unused (${cssUnusedPercent.toFixed(1)}%)`);
    console.log(`JS:  ${totalJSBytes}  bytes total, ${unusedJSBytes}  unused (${jsUnusedPercent.toFixed(1)}%)`);
    console.log(`Libraries detected: ${detectedLibraries.map(l => l.name).join(', ') || 'none'}`);

    return {
      url,

      // Summary percentages (used by the stat cards in App.js)
      jsUnused:  jsUnusedPercent,
      cssUnused: cssUnusedPercent,

      // Size in KB (for carbon card)
      totalSize:      totalBytes / 1024,
      usedSize:       usedBytes  / 1024,
      unusedSize:     unusedBytes / 1024,
      carbonFootprint: (totalBytes / (1024 * 1024)) * 0.5,

      // Per-file breakdown with real optimized content
      cssFiles,
      jsFiles,

      // Detected libraries with alternatives
      detectedLibraries,

      // Raw metrics for compatibility
      metrics: {
        total:   { js: totalJSBytes,  css: totalCSSBytes  },
        unused:  { js: unusedJSBytes, css: unusedCSSBytes },
        used:    { js: totalJSBytes - unusedJSBytes, css: totalCSSBytes - unusedCSSBytes },
        percentages: {
          js:  jsUnusedPercent.toFixed(2),
          css: cssUnusedPercent.toFixed(2)
        }
      }
    };

  } catch (error) {
    await browser.close();
    throw error;
  }
}

module.exports = { analyzeWebsite };
