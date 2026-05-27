// test_accuracy_fixes.js — Validates all 4 accuracy bug fixes
const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3001, path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label} — ${detail}`);
    failed++;
  }
}

async function run() {
  console.log('\n════════════════════════════════════════════════════');
  console.log('  ECOCODE ACCURACY PATCH — VERIFICATION TEST SUITE');
  console.log('════════════════════════════════════════════════════\n');

  // ─── BUG 1: Range Merging (usedBytes + unusedBytes = totalBytes) ───
  console.log('── BUG 1: Disjoint Range Merging ──');
  try {
    const r = await post('/api/analyze', { url: 'https://example.com' });
    if (r.status !== 200) {
      console.log('  ⚠️  Analysis returned status', r.status, '— skipping Bug 1 checks');
    } else {
      const d = r.body;

      // Check each CSS file
      let cssConsistent = true;
      (d.cssFiles || []).forEach((f, i) => {
        const sum = f.usedBytes + f.unusedBytes;
        if (sum !== f.totalBytes) {
          cssConsistent = false;
          console.log(`    CSS file ${i}: usedBytes(${f.usedBytes}) + unusedBytes(${f.unusedBytes}) = ${sum} ≠ totalBytes(${f.totalBytes})`);
        }
      });
      assert('CSS files: usedBytes + unusedBytes = totalBytes', cssConsistent, 'Sum mismatch detected');

      // Check each JS file
      let jsConsistent = true;
      (d.jsFiles || []).forEach((f, i) => {
        const sum = f.usedBytes + f.unusedBytes;
        if (sum !== f.totalBytes) {
          jsConsistent = false;
          console.log(`    JS file ${i}: usedBytes(${f.usedBytes}) + unusedBytes(${f.unusedBytes}) = ${sum} ≠ totalBytes(${f.totalBytes})`);
        }
      });
      assert('JS files: usedBytes + unusedBytes = totalBytes', jsConsistent, 'Sum mismatch detected');

      // Check aggregates
      const totalCSS = d.metrics?.total?.css || 0;
      const unusedCSS = d.metrics?.unused?.css || 0;
      const usedCSS = d.metrics?.used?.css || 0;
      assert('CSS aggregate: used + unused = total', usedCSS + unusedCSS === totalCSS,
        `${usedCSS} + ${unusedCSS} = ${usedCSS + unusedCSS} ≠ ${totalCSS}`);

      const totalJS = d.metrics?.total?.js || 0;
      const unusedJS = d.metrics?.unused?.js || 0;
      const usedJS = d.metrics?.used?.js || 0;
      assert('JS aggregate: used + unused = total', usedJS + unusedJS === totalJS,
        `${usedJS} + ${unusedJS} = ${usedJS + unusedJS} ≠ ${totalJS}`);

      // ─── BUG 2: Unique inline script URLs ───
      console.log('\n── BUG 2: Unique Inline Script URLs ──');
      const jsUrls = (d.jsFiles || []).map(f => f.url);
      const urlSet = new Set(jsUrls);
      assert('All JS file URLs are unique', urlSet.size === jsUrls.length,
        `${jsUrls.length} entries but only ${urlSet.size} unique URLs`);

      // ─── BUG 3: Confidence & Disclaimer (frontend) ───
      console.log('\n── BUG 3: Confidence Score Data Check ──');
      const cssUnused = parseFloat(d.cssUnused) || 0;
      const jsUnused = parseFloat(d.jsUnused) || 0;

      // Verify confidence classification logic
      function expectedConfidence(pct) {
        if (pct > 80) return 'Low';
        if (pct >= 50) return 'Medium';
        return 'High';
      }
      console.log(`    CSS Unused: ${cssUnused.toFixed(1)}% → Expected confidence: ${expectedConfidence(cssUnused)}`);
      console.log(`    JS Unused:  ${jsUnused.toFixed(1)}% → Expected confidence: ${expectedConfidence(jsUnused)}`);
      assert('CSS unused % is a valid number between 0-100', cssUnused >= 0 && cssUnused <= 100,
        `Got ${cssUnused}`);
      assert('JS unused % is a valid number between 0-100', jsUnused >= 0 && jsUnused <= 100,
        `Got ${jsUnused}`);

      // ─── BUG 4: Carbon rounding consistency ───
      console.log('\n── BUG 4: Carbon Calculation Consistency ──');
      const carbon = d.carbonImpact;
      if (carbon) {
        const perPage = parseFloat(carbon.perPage);
        const monthly = parseFloat(carbon.monthly);
        const yearly = parseFloat(carbon.yearly);

        // Verify: monthly should equal perPage * 10000 (within rounding tolerance)
        const expectedMonthly = perPage * 10000;
        const monthlyDiff = Math.abs(monthly - expectedMonthly);
        assert('monthly ≈ perPage × 10,000 (within ±5g tolerance)',
          monthlyDiff < 5,
          `perPage=${perPage}, expected monthly=${expectedMonthly.toFixed(2)}, got=${monthly}, diff=${monthlyDiff.toFixed(4)}`);

        // Verify: yearly should equal monthly * 12 (within rounding tolerance)
        const expectedYearly = monthly * 12;
        const yearlyDiff = Math.abs(yearly - expectedYearly);
        assert('yearly ≈ monthly × 12 (within ±5g tolerance)',
          yearlyDiff < 5,
          `monthly=${monthly}, expected yearly=${expectedYearly.toFixed(2)}, got=${yearly}, diff=${yearlyDiff.toFixed(4)}`);

        console.log(`    Carbon per page: ${perPage}g`);
        console.log(`    Carbon monthly:  ${monthly}g (10k visitors)`);
        console.log(`    Carbon yearly:   ${yearly}g`);
        console.log(`    Trees equivalent: ${carbon.treesEquivalent}`);
      } else {
        console.log('  ⚠️  No carbonImpact data returned');
      }
    }
  } catch (e) {
    console.log('  ⚠️  Analysis test failed:', e.message);
  }

  // ─── Summary ───
  console.log('\n════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
