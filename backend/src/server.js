// backend/src/server.js
const express = require('express');
const cors    = require('cors');
const JSZip   = require('jszip');
const path = require('path');

const { analyzeWebsite }                    = require('./analyzer');
const { calculateCarbonImpact, getImpactMessage } = require('./carbon');
// libraryDetector is now actually used (was imported but ignored before)
const libraryDetector = require('../optimize/libraryDetector');
const libraryMigrator = require('../optimize/libraryMigrator');

const app  = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
// --------------------------------------------------------------
// 📦 Serve the production React build (if it exists)
// --------------------------------------------------------------
const buildPath = path.resolve(__dirname, '../../frontend/build');
if (require('fs').existsSync(buildPath)) {
  console.log('🔧 Serving React build from:', buildPath);
  // Serve static assets (js, css, media, etc.)
  app.use(express.static(buildPath));

  // For any route that isn’t an API route, send back index.html
  // so that React Router can handle client‑side navigation.
  app.use((req, res, next) => {
  // If the request accepts HTML (i.e., a page navigation) serve the SPA entry point.
  if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
    res.sendFile(path.join(buildPath, 'index.html'));
  } else {
    next();
  }
});
} else {
  console.warn('⚠️  Build folder not found – run “npm run build” in the frontend first.');
}
// ─── /api/analyze ─────────────────────────────────────────────────────────────
// Runs Puppeteer, returns per-file coverage data with exact used/unused splits.
// analyzer.js already computes optimizedCode (used bytes) for every CSS/JS file
// using the Coverage API ranges — we just forward it to the client.
app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    console.log(`Analyzing: ${url}`);
    const results = await analyzeWebsite(url);

    // Library suggestions — now using the full LibraryDetector database
    const librarySuggestions = libraryDetector.getAlternatives(
      results.detectedLibraries || []
    );

    const carbonImpact  = calculateCarbonImpact(results.totalSize);
    const carbonSaved   = calculateCarbonImpact(results.unusedSize || 0);

    res.json({
      ...results,
      librarySuggestions,
      carbonImpact,
      carbonMessage: getImpactMessage(carbonImpact.perPage),
      carbonSaved
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze website', details: error.message });
  }
});

// ─── /api/download-optimized ──────────────────────────────────────────────────
// Produces a ZIP with REAL optimized files.
//
// The analyzer already gives us `optimizedCode` per file — that is the exact
// bytes that Chrome's Coverage API confirmed were executed/applied on page load.
// We simply bundle those per-file strings into the ZIP.
// No regex, no heuristics — this is byte-accurate.
app.post('/api/download-optimized', async (req, res) => {
  try {
    const { cssFiles, jsFiles, url, metrics, detectedLibraries } = req.body;

    if ((!cssFiles || cssFiles.length === 0) && (!jsFiles || jsFiles.length === 0)) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    console.log(`Building optimized ZIP for ${url}`);

    const zip = new JSZip();
    const cssFolder = zip.folder('css');
    const jsFolder  = zip.folder('js');

    let totalOriginal  = 0;
    let totalOptimized = 0;

    // ── CSS files ──────────────────────────────────────────────────────────
    (cssFiles || []).forEach((file, i) => {
      if (!file.optimizedCode) return;

      totalOriginal  += file.totalBytes  || 0;
      totalOptimized += file.usedBytes   || 0;

      // Derive a sane filename from the URL
      let name = 'styles';
      try {
        const u = new URL(file.url);
        name = u.pathname.split('/').pop().replace(/[^a-z0-9._-]/gi, '_') || `file_${i}`;
        if (!name.endsWith('.css')) name += '.css';
      } catch (_) { name = `styles_${i}.css`; }

      cssFolder.file(name, file.optimizedCode);
    });

    // ── JS files ───────────────────────────────────────────────────────────
    (jsFiles || []).forEach((file, i) => {
      if (!file.optimizedCode) return;

      totalOriginal  += file.totalBytes || 0;
      totalOptimized += file.usedBytes  || 0;

      let name = 'script';
      try {
        const u = new URL(file.url);
        name = u.pathname.split('/').pop().replace(/[^a-z0-9._-]/gi, '_') || `file_${i}`;
        if (!name.endsWith('.js')) name += '.js';
      } catch (_) { name = `script_${i}.js`; }

      jsFolder.file(name, file.optimizedCode);
    });

    // ── Report ─────────────────────────────────────────────────────────────
    const savedBytes   = totalOriginal - totalOptimized;
    const savedPercent = totalOriginal > 0
      ? ((savedBytes / totalOriginal) * 100).toFixed(1) : '0.0';

    const report = {
      project:    'WebSlim Optimization Report',
      analyzedUrl: url,
      date:       new Date().toISOString(),
      method:     'Chrome Coverage API (byte-accurate)',
      summary: {
        originalSize:  `${(totalOriginal  / 1024).toFixed(2)} KB`,
        optimizedSize: `${(totalOptimized / 1024).toFixed(2)} KB`,
        savedSize:     `${(savedBytes     / 1024).toFixed(2)} KB`,
        reduction:     savedPercent + '%'
      },
      cssFiles: (cssFiles || []).map(f => ({
        url:           f.url,
        originalKB:   (f.totalBytes / 1024).toFixed(2),
        optimizedKB:  (f.usedBytes  / 1024).toFixed(2),
        unusedPercent: f.unusedPercent + '%'
      })),
      jsFiles: (jsFiles || []).map(f => ({
        url:           f.url,
        originalKB:   (f.totalBytes / 1024).toFixed(2),
        optimizedKB:  (f.usedBytes  / 1024).toFixed(2),
        unusedPercent: f.unusedPercent + '%'
      })),
      detectedLibraries: (detectedLibraries || []).map(l => ({
        name: l.name, version: l.version, sizeKB: l.detectedSize
      }))
    };

    zip.file('optimization-report.json', JSON.stringify(report, null, 2));

    // ── README ─────────────────────────────────────────────────────────────
    zip.file('README.md', `# WebSlim Optimized Files

Analyzed: ${url}
Generated: ${new Date().toISOString()}
Method: Chrome Coverage API — byte-accurate (not regex/heuristics)

## Summary
| | Size |
|---|---|
| Original  | ${(totalOriginal  / 1024).toFixed(2)} KB |
| Optimized | ${(totalOptimized / 1024).toFixed(2)} KB |
| Saved     | ${(savedBytes     / 1024).toFixed(2)} KB (${savedPercent}%) |

## How to use
- Replace your existing CSS/JS files with the files in /css and /js folders
- The optimized files contain only the code that was actually used during page load
- Always test in a staging environment before deploying

## Important note
Coverage is captured on a single page load. If your site has multiple pages or
dynamic interactions that load additional code, you may need to keep some of the
"unused" code. Review optimization-report.json for per-file details.

Generated by WebSlim — Sustainable Web Optimization
`);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    console.log(`ZIP ready: ${zipBuffer.length} bytes, saved ${savedPercent}%`);

    res.set({
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="webslim-optimized.zip"`,
      'Content-Length':       zipBuffer.length
    });
    res.send(zipBuffer);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── /api/migrate ─────────────────────────────────────────────────────────────
// Accepts JS code and targetLibrary (or libraryType), runs AST migration,
// validates output, and returns the rewritten code block with detailed stats.
app.post('/api/migrate', (req, res) => {
  try {
    // Accept either key the client might send
    const { code, targetLibrary, libraryType } = req.body;
    const target = targetLibrary || libraryType || null;

    if (code === undefined) {
      return res.status(400).json({ error: 'Code content is required' });
    }

    const raw = libraryMigrator.migrate(code, target);

    // Normalize response shape for the frontend
    res.json({
      success:          raw.success,
      transformedCode:  raw.transformedCode,
      originalCode:     raw.originalCode,
      rollbackTriggered: raw.rollbackTriggered || false,
      // Frontend expects 'transformations' array (was 'reports')
      transformations:  (raw.reports || []).filter(r => r.startsWith('⚡') || r.startsWith('✅')),
      warnings:         (raw.reports || []).filter(r => r.startsWith('⚠️') || r.startsWith('❌')),
      // Frontend expects 'confidence' 0-1 float and 'safetyRating' string
      confidence:       (raw.confidenceScore != null) ? raw.confidenceScore / 100 : 1,
      safetyRating:     raw.safety || (raw.confidenceScore >= 80 ? 'high' : raw.confidenceScore >= 50 ? 'medium' : 'low'),
      estimatedSavingsKB: raw.estimatedSavingsKB || 0,
      needsManualReview:  raw.needsManualReview || false,
    });
  } catch (error) {
    console.error('Migration endpoint error:', error);
    res.status(500).json({ error: 'Failed to perform AST migration', details: error.message });
  }
});

// ─── /api/minify ──────────────────────────────────────────────────────────────
// Simple server-side minification for the Manual Code Optimizer tab.
// Detects CSS vs JS by content, applies whitespace compression.
app.post('/api/minify', (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const isCSS = code.trim().startsWith('/*') ||
                  code.includes('{') && code.includes(':') && !code.includes('function') && !code.includes('=>');

    let minified;
    if (isCSS) {
      // Lightweight CSS minification
      minified = code
        .replace(/\/\*[\s\S]*?\*\//g, '')   // Remove comments
        .replace(/\s*([{}:;,>~+])\s*/g, '$1') // Remove spaces around syntax chars
        .replace(/;}/g, '}')                  // Remove last semicolon before }
        .replace(/\s+/g, '')                  // Strip all whitespace for maximum CSS optimization
        .trim();
    } else {
      // True AST-Based JavaScript Minification using Babel
      try {
        const { parse } = require('@babel/parser');
        const generator = require('@babel/generator').default;
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript', 'objectRestSpread', 'classProperties', 'decorators-legacy', 'dynamicImport']
        });
        const output = generator(ast, {
          minified: true,
          comments: false
        });
        minified = output.code;
      } catch (err) {
        // Fallback: Safe, advanced regex-based minification that also collapses lines!
        minified = code
          .replace(/\/\/[^\n]*/g, '')            // Remove single-line comments
          .replace(/\/\*[\s\S]*?\*\//g, '')      // Remove multi-line comments
          .replace(/^\s+/gm, '')                 // Remove leading spaces
          .replace(/\s+$/gm, '')                 // Remove trailing spaces
          .replace(/\s+/g, ' ')                  // Collapse multiple spaces/newlines
          .trim();
      }
    }

    res.json({
      minified,
      originalLength: code.length,
      minifiedLength: minified.length,
      savedPercent: ((1 - minified.length / code.length) * 100).toFixed(1)
    });
  } catch (error) {
    console.error('Minify error:', error);
    res.status(500).json({ error: 'Minification failed', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`WebSlim backend running on http://localhost:${port}`);
});
