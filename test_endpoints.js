// test_endpoints.js — Quick smoke test for new endpoints
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

async function run() {
  console.log('\n=== Testing /api/migrate ===');
  try {
    const r = await post('/api/migrate', {
      targetLibrary: 'jquery',
      code: "import $ from 'jquery';\n$('#app').hide();\n$.ajax({ url: '/data', success: cb });"
    });
    console.log('Status:', r.status);
    console.log('success:', r.body.success);
    console.log('safetyRating:', r.body.safetyRating);
    console.log('confidence:', r.body.confidence);
    console.log('transformations:', r.body.transformations);
    console.log('rollbackTriggered:', r.body.rollbackTriggered);
    console.log('transformedCode snippet:', (r.body.transformedCode || '').slice(0, 120));
  } catch(e) { console.error('FAILED:', e.message); }

  console.log('\n=== Testing /api/minify ===');
  try {
    const r2 = await post('/api/minify', {
      code: "function hello() {\n  // greeting\n  const x = 1 + 2;\n  return x;\n}"
    });
    console.log('Status:', r2.status);
    console.log('minified:', r2.body.minified);
    console.log('savedPercent:', r2.body.savedPercent + '%');
  } catch(e) { console.error('FAILED:', e.message); }

  console.log('\n=== Testing /api/minify CSS ===');
  try {
    const r3 = await post('/api/minify', {
      code: "/* comment */\n.button {\n  color: red;\n  background: blue;\n}"
    });
    console.log('Status:', r3.status);
    console.log('minified:', r3.body.minified);
    console.log('savedPercent:', r3.body.savedPercent + '%');
  } catch(e) { console.error('FAILED:', e.message); }

  console.log('\nDone!');
}

run();
