// src/App.js — WebSlim Enterprise Platform
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import CodePreview from './CodePreview';
import CarbonSavings from './CarbonSavings';
import { DonutProgress, SavingsBarChart } from './WebSlimCharts';

// ─── Animated Counter Hook ──────────────────────────────────────────────────
function useAnimatedCounter(target, duration = 1200, decimals = 1) {
  const [count, setCount] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target === 0 || target == null) { setCount(0); return; }
    let start = null;
    const from = 0;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(parseFloat((from + (target - from) * eased).toFixed(decimals)));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, decimals]);

  return count;
}

// ─── Animated Stat Card ─────────────────────────────────────────────────────
function StatCard({ icon, label, value, unit, color, decimals = 1, sub }) {
  const animated = useAnimatedCounter(typeof value === 'number' ? value : 0, 1400, decimals);

  const colorMap = {
    green: { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.18)', glow: '#10b981', text: '#34d399' },
    red: { bg: 'rgba(239, 68,  68,  0.08)', border: 'rgba(239, 68,  68,  0.18)', glow: '#ef4444', text: '#f87171' },
    blue: { bg: 'rgba(59,  130, 246, 0.08)', border: 'rgba(59,  130, 246, 0.18)', glow: '#3b82f6', text: '#60a5fa' },
    orange: { bg: 'rgba(249, 115, 22,  0.08)', border: 'rgba(249, 115, 22,  0.18)', glow: '#f97316', text: '#fb923c' },
  };
  const c = colorMap[color] || colorMap.green;

  // FIX: Dynamic Confidence Score Badge based on range (Unused % > 80% -> Low; 50%-80% -> Medium; <= 50% -> High)
  let confidenceBadge = null;
  if (label === 'JS Unused' || label === 'CSS Unused') {
    const pct = typeof value === 'number' ? value : parseFloat(value) || 0;
    let badgeText = '';
    let badgeColor = '';
    let badgeBg = '';

    if (pct > 80) {
      badgeText = 'Low';
      badgeColor = '#f87171';
      badgeBg = 'rgba(239, 68, 68, 0.15)';
    } else if (pct >= 50) {
      badgeText = 'Medium';
      badgeColor = '#fb923c';
      badgeBg = 'rgba(249, 115, 22, 0.15)';
    } else {
      badgeText = 'High';
      badgeColor = '#34d399';
      badgeBg = 'rgba(16, 185, 129, 0.15)';
    }

    confidenceBadge = (
      <span className="confidence-badge" style={{
        fontSize: '11px',
        fontWeight: '700',
        padding: '3px 8px',
        borderRadius: '6px',
        background: badgeBg,
        color: badgeColor,
        border: `1px solid ${badgeColor}33`,
        marginLeft: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        lineHeight: '1'
      }}>
        {badgeText} Confidence
      </span>
    );
  }

  return (
    <div className="stat-card-premium" style={{ background: c.bg, borderColor: c.border }}>
      <div className="scp-icon">{icon}</div>
      <div className="scp-body">
        <div className="scp-label">{label}</div>
        <div className="scp-value" style={{ color: c.text, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
          <span>{typeof value === 'string' ? value : animated}</span>
          {unit && <span className="scp-unit">{unit}</span>}
          {confidenceBadge}
        </div>
        {sub && <div className="scp-sub">{sub}</div>}
      </div>
      <div className="scp-glow" style={{ background: c.glow }} />
    </div>
  );
}

// ─── Sidebar Nav ────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'analyzer', icon: '🔬', label: 'Analyzer', desc: 'Coverage & Bloat' },
  { id: 'migrator', icon: '⚡', label: 'AI Migrator', desc: 'AST Code Refactor' },
  { id: 'carbon', icon: '🌍', label: 'Carbon Analytics', desc: 'Eco Impact' },
  { id: 'manual', icon: '✏️', label: 'Manual Optimizer', desc: 'Code Playground' },
];

// ─── Library Migrator Targets ───────────────────────────────────────────────
const MIGRATOR_TARGETS = [
  { id: 'jquery', label: 'jQuery', badge: '87KB', color: '#60a5fa', desc: '→ native DOM / fetch' },
  { id: 'lodash', label: 'Lodash', badge: '24KB', color: '#a78bfa', desc: '→ cherry-pick / native ES' },
  { id: 'moment', label: 'Moment.js', badge: '67KB', color: '#f87171', desc: '→ Day.js (2KB)' },
  { id: 'axios', label: 'Axios', badge: '13KB', color: '#fb923c', desc: '→ native fetch' },
  { id: 'bootstrap', label: 'Bootstrap', badge: '60KB', color: '#34d399', desc: '→ CSS Grid / Flexbox' },
];

const SAMPLE_CODE = {
  jquery: `// jQuery example\nimport $ from 'jquery';\n\n$('#app').hide();\n$('.items').each(function() {\n  $(this).css('color', 'red');\n});\n$.ajax({ url: '/api/data', success: cb });`,
  lodash: `// Lodash example\nimport _ from 'lodash';\n\nconst result = _.map(arr, x => x * 2);\nconst flat   = _.flatten([[1, 2], [3]]);\nconst unique = _.uniq([1, 1, 2, 3]);`,
  moment: `// Moment.js example\nimport moment from 'moment';\n\nconst now   = moment();\nconst fmt   = moment().format('YYYY-MM-DD');\nconst plus1 = moment().add(1, 'days');\nconst diff  = moment(a).diff(b, 'days');`,
  axios: `// Axios example\nimport axios from 'axios';\n\nconst res  = await axios.get('/api/users');\nconst post = await axios.post('/api/data', { key: 'value' });\naxios.interceptors.request.use(cfg => cfg);`,
  bootstrap: `/* Bootstrap imports */\n@import "bootstrap/css/bootstrap.min.css";\n\n.container { ... }\n.row       { ... }\n.col-md-6  { ... }`,
};

// ─── Main App ────────────────────────────────────────────────────────────────
function App() {
  // ── Global UI state
  const [activeTab, setActiveTab] = useState('analyzer');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Analyzer state
  const [url, setUrl] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Migrator state
  const [migrTarget, setMigrTarget] = useState('jquery');
  const [migrInput, setMigrInput] = useState(SAMPLE_CODE.jquery);
  const [migrOutput, setMigrOutput] = useState('');
  const [migrReport, setMigrReport] = useState(null);
  const [migrLoading, setMigrLoading] = useState(false);
  const [migrError, setMigrError] = useState('');

  // ── Manual playground state
  const [manualInput, setManualInput] = useState('');
  const [manualOutput, setManualOutput] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // ── Analyzer helpers
  const handleAnalyze = async () => {
    if (!url.trim()) { setError('Please enter a valid URL'); return; }
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const { data: d } = await axios.post('http://localhost:3001/api/analyze', { url: fullUrl });
      setResults({
        url: d.url,
        jsUnused: parseFloat(d.jsUnused) || 0,
        cssUnused: parseFloat(d.cssUnused) || 0,
        totalSize: d.totalSize || 0,
        unusedSize: d.unusedSize || 0,
        carbonFootprint: d.carbonFootprint || 0,
        cssFiles: d.cssFiles || [],
        jsFiles: d.jsFiles || [],
        detectedLibraries: d.detectedLibraries || [],
        librarySuggestions: d.librarySuggestions || [],
        metrics: d.metrics || {},
        carbonImpact: d.carbonImpact || null,
        carbonSaved: d.carbonSaved || null,
      });
    } catch (err) {
      setError(err.response?.data?.details || 'Analysis failed. Make sure the backend is running on port 3001.');
    }
    setLoading(false);
  };

  const handleKeyDown = e => { if (e.key === 'Enter') handleAnalyze(); };

  const fmtKB = kb =>
    kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb.toFixed(1)} KB`;

  // ── Migrator helpers
  const handleMigrTargetChange = (id) => {
    setMigrTarget(id);
    setMigrInput(SAMPLE_CODE[id] || '');
    setMigrOutput('');
    setMigrReport(null);
    setMigrError('');
  };

  const handleMigrate = async () => {
    if (!migrInput.trim()) { setMigrError('Paste some code first.'); return; }
    setMigrLoading(true);
    setMigrError('');
    setMigrOutput('');
    setMigrReport(null);

    try {
      const { data } = await axios.post('http://localhost:3001/api/migrate', {
        code: migrInput,
        targetLibrary: migrTarget,
      });
      setMigrOutput(data.transformedCode || '');
      setMigrReport(data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Migration failed';
      setMigrError(msg);
    }
    setMigrLoading(false);
  };

  const copyMigrOutput = async () => {
    if (!migrOutput) return;
    try {
      await navigator.clipboard.writeText(migrOutput);
    } catch { }
  };

  // ── Manual helpers
  const handleManualMinify = async () => {
    if (!manualInput.trim()) return;
    setManualLoading(true);
    try {
      const { data } = await axios.post('http://localhost:3001/api/minify', { code: manualInput });
      setManualOutput(data.minified || data.result || '// No output');
    } catch (err) {
      setManualOutput(`// Error: ${err.response?.data?.error || err.message}`);
    }
    setManualLoading(false);
  };

  // ── Derived values for stats
  const totalOriginalKB = results
    ? [...(results.cssFiles || []), ...(results.jsFiles || [])].reduce((s, f) => s + (f.totalBytes || 0), 0) / 1024
    : 0;
  const totalOptimizedKB = results
    ? [...(results.cssFiles || []), ...(results.jsFiles || [])].reduce((s, f) => s + (f.usedBytes || 0), 0) / 1024
    : 0;
  const savedKB = totalOriginalKB - totalOptimizedKB;

  return (
    <div className="App">
      {/* ── Sidebar ── */}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#logoGrad)" />
              {/* Premium Seedling Vector Icon */}
              <path d="M14 21V9M14 14C11.5 12.5 8 13.5 8 13.5S9.5 10 14 11.5M14 11.5C16.5 10 20 11 20 11S18.5 7.5 14 9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10b981" />
                  <stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1>WebSlim</h1>
          </div>
        </div>

        <nav className="sidebar-menu">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-item-text">
                <span className="sidebar-label">{item.label}</span>
                <span className="sidebar-sub">{item.desc}</span>
              </span>
              {activeTab === item.id && <span className="sidebar-active-bar" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className="status-dot" />
            Backend connected · Port 3001
          </div>
          <div style={{ marginTop: 6 }}>© 2025 WebSlim</div>
        </div>
      </aside>

      {/* ── Mobile hamburger ── */}
      <button className="hamburger" onClick={() => setSidebarOpen(v => !v)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* ── Backdrop ── */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main content area ── */}
      <div className="app-content-wrapper">
        <main className="App-main">

          {/* ════════════════ ANALYZER TAB ════════════════ */}
          {activeTab === 'analyzer' && (
            <>
              <div className="section-header">
                <h2 className="section-title">🔬 Website Analyzer</h2>
                <p className="section-desc">
                  Run a byte-accurate Chrome Coverage scan to detect JS/CSS bloat and carbon impact.
                </p>
              </div>

              {/* URL Input */}
              <div className="input-section">
                <input
                  id="url-input"
                  type="text"
                  placeholder="Enter website URL  (e.g. https://example.com)"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="url-input"
                />
                <button
                  id="analyze-btn"
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="analyze-btn"
                >
                  {loading
                    ? <><span className="btn-spinner" /> Scanning…</>
                    : <><span>⚡</span> Analyze</>}
                </button>
              </div>

              {/* Loading state */}
              {loading && (
                <div className="loading-info">
                  <div className="loading-ring">
                    <div className="loading-spinner" />
                    <div className="loading-pulse" />
                  </div>
                  <p className="loading-title">Running Coverage Analysis</p>
                  <p className="loading-url">{url}</p>
                  <p className="loading-sub">
                    Headless Chrome is capturing execution traces — this takes 20–60s.
                  </p>
                  <div className="loading-steps">
                    <div className="ls-step done">Launching browser</div>
                    <div className="ls-step active">Capturing coverage data</div>
                    <div className="ls-step">Computing savings</div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="error-message">
                  <span>⚠️</span> {error}
                </div>
              )}

              {/* Results */}
              {results && (
                <>
                  <div className="results-url-bar">
                    <span className="results-badge">✅ Analysis Complete</span>
                    <span className="result-url">{results.url}</span>
                  </div>

                  {/* Stat cards grid */}
                  <div className="stats-grid-premium">
                    <StatCard
                      icon="📦"
                      label="JS Unused"
                      value={results.jsUnused}
                      unit="%"
                      color="red"
                      decimals={1}
                      sub={`${results.jsFiles.length} JS file${results.jsFiles.length !== 1 ? 's' : ''} scanned`}
                    />
                    <StatCard
                      icon="🎨"
                      label="CSS Unused"
                      value={results.cssUnused}
                      unit="%"
                      color="red"
                      decimals={1}
                      sub={`${results.cssFiles.length} CSS file${results.cssFiles.length !== 1 ? 's' : ''} scanned`}
                    />
                    <StatCard
                      icon="💾"
                      label="Potential Savings"
                      value={savedKB}
                      unit=" KB"
                      color="green"
                      decimals={1}
                      sub={`Of ${fmtKB(totalOriginalKB)} total`}
                    />
                    <StatCard
                      icon="🌱"
                      label="Carbon / Load"
                      value={results.carbonFootprint}
                      unit="g CO₂"
                      color="orange"
                      decimals={2}
                      sub={results.carbonImpact ? `${results.carbonImpact.monthly}g/month (10k visitors)` : 'Per page view'}
                    />
                  </div>

                  {/* FIX: Warning disclaimer for theoretical savings maximums */}
                  <div className="disclaimer-banner" style={{
                    background: 'rgba(249, 115, 22, 0.05)',
                    border: '1px solid rgba(249, 115, 22, 0.15)',
                    borderRadius: '10px',
                    padding: '12px 18px',
                    color: '#fb923c',
                    fontSize: '13px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    lineHeight: '1.5'
                  }}>
                    <span>⚠️ Theoretical Maximum - Dynamic styles (:hover, @media) require manual verification</span>
                  </div>

                  {/* Premium SVG Charts Section */}
                  <div className="premium-charts-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', margin: '24px 0' }}>
                    <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '20px', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <DonutProgress pct={results.jsUnused} label="JavaScript Bloat" type="red" />
                      <DonutProgress pct={results.cssUnused} label="CSS Bloat" type="red" />
                    </div>
                    <SavingsBarChart
                      originalJS={results.jsFiles.reduce((s, f) => s + (f.totalBytes || 0), 0)}
                      optimizedJS={results.jsFiles.reduce((s, f) => s + (f.usedBytes || 0), 0)}
                      originalCSS={results.cssFiles.reduce((s, f) => s + (f.totalBytes || 0), 0)}
                      optimizedCSS={results.cssFiles.reduce((s, f) => s + (f.usedBytes || 0), 0)}
                    />
                  </div>

                  {/* Code preview */}
                  <CodePreview analysisResults={results} />
                </>
              )}

              {/* Empty state */}
              {!loading && !results && !error && (
                <div className="empty-state">
                  <div className="empty-icon">🌐</div>
                  <h3>Ready to Optimize</h3>
                  <p>Enter any public URL above to begin a byte-accurate coverage analysis.</p>
                  <div className="empty-features">
                    <div className="ef-item"><span>🎯</span> Byte-accurate unused code detection</div>
                    <div className="ef-item"><span>🌿</span> Real-time carbon footprint calculation</div>
                    <div className="ef-item"><span>⚡</span> AST-powered library migration</div>
                    <div className="ef-item"><span>📦</span> One-click optimized asset download</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════════════ AI MIGRATOR TAB ════════════════ */}
          {activeTab === 'migrator' && (
            <>
              <div className="section-header">
                <h2 className="section-title">⚡ AI Library Migrator</h2>
                <p className="section-desc">
                  AST-powered safe rewriting of heavy dependencies to lightweight modern alternatives.
                </p>
              </div>

              <div className="migrator-grid">
                {/* Target library panel */}
                <div className="migrator-options-panel">
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
                    Target Library
                  </div>
                  {MIGRATOR_TARGETS.map(t => (
                    <button
                      key={t.id}
                      id={`migr-target-${t.id}`}
                      className={`migrator-btn ${migrTarget === t.id ? 'active' : ''}`}
                      onClick={() => handleMigrTargetChange(t.id)}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t.desc}</div>
                      </div>
                      <span style={{
                        background: migrTarget === t.id ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                        color: migrTarget === t.id ? '#34d399' : '#64748b',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}>{t.badge}</span>
                    </button>
                  ))}

                  <div style={{ marginTop: 16, padding: '14px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: '#34d399', fontWeight: 700, marginBottom: 6 }}>🛡️ Safety Mode</div>
                    <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                      All transforms are validated via AST re-parse. If syntax breaks, the original code is returned with a rollback flag.
                    </p>
                  </div>
                </div>

                {/* Editor panel */}
                <div className="migrator-editor-wrapper">
                  {/* Split view */}
                  <div className="migrator-split-view">
                    <div className="migrator-column">
                      <div className="migrator-col-header">
                        <span style={{ color: '#ef4444' }}>●</span>&nbsp; INPUT · {MIGRATOR_TARGETS.find(t => t.id === migrTarget)?.label}
                      </div>
                      <textarea
                        id="migrator-input"
                        className="migrator-textarea"
                        value={migrInput}
                        onChange={e => setMigrInput(e.target.value)}
                        spellCheck={false}
                        placeholder="Paste your JavaScript code here…"
                      />
                      <div className="migrator-col-footer">
                        <span style={{ fontSize: 11, color: '#475569' }}>
                          {migrInput.split('\n').length} lines · {migrInput.length} chars
                        </span>
                        <button
                          id="run-migration-btn"
                          className="analyze-btn"
                          onClick={handleMigrate}
                          disabled={migrLoading}
                          style={{ padding: '8px 18px', fontSize: 12 }}
                        >
                          {migrLoading
                            ? <><span className="btn-spinner" /> Transforming…</>
                            : '⚡ Run Migration'}
                        </button>
                      </div>
                    </div>

                    <div className="migrator-column">
                      <div className="migrator-col-header">
                        <span style={{ color: '#10b981' }}>●</span>&nbsp; OUTPUT · Optimized Code
                        {migrOutput && (
                          <button
                            onClick={copyMigrOutput}
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', fontSize: 11, cursor: 'pointer' }}
                          >
                            📋 Copy
                          </button>
                        )}
                      </div>
                      <div className={`migrator-output-code ${!migrOutput ? 'empty' : ''}`}>
                        {migrError
                          ? <span style={{ color: '#f87171' }}>{migrError}</span>
                          : migrOutput || (
                            <span>
                              Paste code on the left and click<br />
                              <strong style={{ color: '#34d399' }}>⚡ Run Migration</strong>
                            </span>
                          )}
                      </div>
                      <div className="migrator-col-footer">
                        {migrReport && !migrReport.rollbackTriggered && (
                          <span style={{ fontSize: 11, color: '#34d399' }}>
                            ✅ {migrReport.transformations?.length || 0} transformation{(migrReport.transformations?.length || 0) !== 1 ? 's' : ''} applied
                          </span>
                        )}
                        {migrReport?.rollbackTriggered && (
                          <span style={{ fontSize: 11, color: '#f87171' }}>
                            ⚠️ Rollback triggered — original code preserved
                          </span>
                        )}
                        {!migrReport && <span style={{ fontSize: 11, color: '#475569' }}>Awaiting input…</span>}
                      </div>
                    </div>
                  </div>

                  {/* Migration report */}
                  {migrReport && (
                    <div className="migrator-report-panel">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                          🔍 Migration Report
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {migrReport.safetyRating && (
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                              background: migrReport.safetyRating === 'high' ? 'rgba(16,185,129,0.12)' : migrReport.safetyRating === 'medium' ? 'rgba(249,115,22,0.12)' : 'rgba(239,68,68,0.12)',
                              color: migrReport.safetyRating === 'high' ? '#34d399' : migrReport.safetyRating === 'medium' ? '#fb923c' : '#f87171',
                              border: `1px solid ${migrReport.safetyRating === 'high' ? 'rgba(16,185,129,0.2)' : migrReport.safetyRating === 'medium' ? 'rgba(249,115,22,0.2)' : 'rgba(239,68,68,0.2)'}`,
                            }}>
                              🛡️ {migrReport.safetyRating?.toUpperCase()} SAFETY
                            </span>
                          )}
                          {migrReport.confidence != null && (
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                              background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                              border: '1px solid rgba(59,130,246,0.2)',
                            }}>
                              {Math.round(migrReport.confidence * 100)}% CONFIDENCE
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="migrator-report-list">
                        {(migrReport.transformations || []).map((t, i) => (
                          <div key={i} className="report-bullet">
                            <span style={{ color: '#10b981', marginTop: 1 }}>→</span>
                            <span>{t}</span>
                          </div>
                        ))}
                        {(migrReport.warnings || []).map((w, i) => (
                          <div key={`w${i}`} className="report-bullet">
                            <span style={{ color: '#fb923c', marginTop: 1 }}>⚠</span>
                            <span style={{ color: '#fb923c' }}>{w}</span>
                          </div>
                        ))}
                        {(!migrReport.transformations?.length && !migrReport.warnings?.length) && (
                          <div className="report-bullet">
                            <span style={{ color: '#64748b' }}>ℹ</span>
                            <span style={{ color: '#64748b' }}>No specific transformations logged.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ════════════════ CARBON TAB ════════════════ */}
          {activeTab === 'carbon' && (
            <>
              <div className="section-header">
                <h2 className="section-title">🌍 Carbon Analytics</h2>
                <p className="section-desc">
                  Quantify the ecological impact of optimizing your web assets.
                </p>
              </div>

              {results ? (
                <CarbonSavings
                  originalSizeKB={totalOriginalKB}
                  optimizedSizeKB={totalOptimizedKB}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🌱</div>
                  <h3>No Analysis Data Yet</h3>
                  <p>
                    Run an analysis on the <strong style={{ color: '#10b981' }}>Analyzer</strong> tab first,
                    then come back here to see your carbon savings projections.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ════════════════ MANUAL TAB ════════════════ */}
          {activeTab === 'manual' && (
            <>
              <div className="section-header">
                <h2 className="section-title">✏️ Manual Code Optimizer</h2>
                <p className="section-desc">
                  Paste any JS or CSS snippet and run server-side minification.
                </p>
              </div>

              <div className="migrator-editor-wrapper">
                <div className="migrator-split-view">
                  <div className="migrator-column">
                    <div className="migrator-col-header">
                      <span style={{ color: '#60a5fa' }}>●</span>&nbsp; INPUT CODE
                    </div>
                    <textarea
                      id="manual-input"
                      className="migrator-textarea"
                      value={manualInput}
                      onChange={e => setManualInput(e.target.value)}
                      placeholder="Paste your JS or CSS code here…"
                      spellCheck={false}
                    />
                    <div className="migrator-col-footer">
                      <span style={{ fontSize: 11, color: '#475569' }}>
                        {manualInput.split('\n').length} lines
                      </span>
                      <button
                        id="manual-minify-btn"
                        className="analyze-btn"
                        onClick={handleManualMinify}
                        disabled={manualLoading}
                        style={{ padding: '8px 18px', fontSize: 12 }}
                      >
                        {manualLoading
                          ? <><span className="btn-spinner" /> Minifying…</>
                          : '⚡ Minify'}
                      </button>
                    </div>
                  </div>

                  <div className="migrator-column">
                    <div className="migrator-col-header">
                      <span style={{ color: '#10b981' }}>●</span>&nbsp; MINIFIED OUTPUT
                      {manualOutput && (
                        <button
                          onClick={() => navigator.clipboard.writeText(manualOutput)}
                          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', fontSize: 11, cursor: 'pointer' }}
                        >
                          📋 Copy
                        </button>
                      )}
                    </div>
                    <div className={`migrator-output-code ${!manualOutput ? 'empty' : ''}`}>
                      {manualOutput || <span>Output will appear here after minification…</span>}
                    </div>
                    <div className="migrator-col-footer">
                      {manualOutput && manualInput && (
                        <span style={{ fontSize: 11, color: '#34d399' }}>
                          ✅ {(((manualInput.length - manualOutput.length) / (manualInput.length || 1)) * 100).toFixed(0)}% smaller
                          ({manualInput.length - manualOutput.length} chars saved)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="playground-area" style={{ marginTop: 20 }}>
                <div style={{ padding: '16px 20px', background: 'rgba(30,41,59,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#94a3b8' }}>💡 Tips</h4>
                  <div className="migrator-report-list">
                    <div className="report-bullet"><span style={{ color: '#10b981' }}>→</span><span>Works on JS (terser) and CSS (cssnano) automatically</span></div>
                    <div className="report-bullet"><span style={{ color: '#10b981' }}>→</span><span>For library migration, use the <strong style={{ color: '#34d399' }}>AI Migrator</strong> tab</span></div>
                    <div className="report-bullet"><span style={{ color: '#10b981' }}>→</span><span>Paste full files or snippets — the backend handles both</span></div>
                  </div>
                </div>
              </div>
            </>
          )}

        </main>

        <footer className="App-footer">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span>© 2025 WebSlim</span>
            <span style={{ color: '#1e293b' }}>|</span>
            <span>AI-Powered Sustainable Web Optimization</span>
            <span style={{ color: '#1e293b' }}>|</span>
            <span>Powered by Chrome Coverage API + Babel AST</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
