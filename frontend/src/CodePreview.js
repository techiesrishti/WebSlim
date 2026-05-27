// src/CodePreview.js
import React, { useState, useMemo } from 'react';
import axios from 'axios';
import './CodePreview.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

// Format bytes into KB / MB
function fmtBytes(b) {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

// Short label from a full URL
function shortUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || u.hostname;
  } catch {
    return url.slice(0, 40);
  }
}

// ─── AnnotatedCodeBlock ───────────────────────────────────────────────────────
// Renders the annotated lines as a scrollable code block with line highlights.
function AnnotatedCodeBlock({ lines, searchTerm }) {
  const filtered = useMemo(() => {
    if (!lines || lines.length === 0) return [];
    if (!searchTerm) return lines;
    const term = searchTerm.toLowerCase();
    return lines.filter(l => l.content.toLowerCase().includes(term));
  }, [lines, searchTerm]);

  if (!filtered || filtered.length === 0) {
    return <div className="no-code">🔍 No matching code lines found</div>;
  }

  return (
    <div className="annotated-code">
      {filtered.map((line) => (
        <div
          key={line.lineNumber}
          className={`code-line ${line.status}`}
          data-line={line.lineNumber}
        >
          <span className="line-number">{line.lineNumber}</span>
          <span className="line-status-dot" />
          <span
            className="line-content"
            dangerouslySetInnerHTML={{
              __html: searchTerm
                ? escapeHtml(line.content).replace(
                    new RegExp(escapeHtml(searchTerm), 'gi'),
                    m => `<mark class="search-highlight">${m}</mark>`
                  )
                : escapeHtml(line.content) || '&nbsp;'
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── VerticalFileSelector (IDE File Tree Style) ─────────────────────────────
function VerticalFileSelector({ files, selected, onSelect, type }) {
  if (!files || files.length === 0) {
    return <div className="no-files">📁 No {type.toUpperCase()} files found</div>;
  }

  return (
    <div className="file-selector-vertical">
      {files.map((f, i) => {
        const unusedPct = parseFloat(f.unusedPercent) || 0;
        const icon = type === 'css' ? '🌸' : '🔮';
        return (
          <button
            key={i}
            className={`file-tab ${selected === i ? 'active' : ''}`}
            onClick={() => onSelect(i)}
            title={f.url}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <span>{icon}</span>
              <span className="file-tab-name">{shortUrl(f.url)}</span>
            </div>
            <span className={`file-tab-badge ${unusedPct > 50 ? 'high' : unusedPct > 25 ? 'med' : 'low'}`}>
              {unusedPct.toFixed(0)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── LibrarySuggestions Panel ─────────────────────────────────────────────────
function LibrarySuggestions({ suggestions, detected }) {
  const [open, setOpen] = useState({});
  const toggle = key => setOpen(p => ({ ...p, [key]: !p[key] }));

  if (!detected || detected.length === 0) {
    return (
      <div className="no-suggestions">
        <span className="no-sugg-icon">🎉</span>
        <h4>No heavy libraries detected!</h4>
        <p>Your site is ultra-clean! No heavy frameworks like jQuery, Bootstrap, or Moment.js are loaded.</p>
      </div>
    );
  }

  // Group suggestions by original library
  const grouped = {};
  (suggestions || []).forEach(s => {
    const key = s.originalLibrary;
    if (!grouped[key]) grouped[key] = { ...s, alts: [] };
    if (s.alternative) grouped[key].alts.push(s.alternative);
  });

  return (
    <div className="suggestions-panel">
      <h3>💡 Dependency Modernization Insights</h3>
      <p className="sugg-intro">
        Detected {detected.length} potentially heavy {detected.length > 1 ? 'dependencies' : 'dependency'}. Lightweight alternatives MAY reduce frontend bundle weight depending on integration depth, usage patterns, and runtime behavior.
      </p>

      <div className="disclaimer-banner" style={{
        background: 'rgba(249, 115, 22, 0.05)',
        border: '1px solid rgba(249, 115, 22, 0.15)',
        borderRadius: '10px',
        padding: '10px 14px',
        color: '#fb923c',
        fontSize: '12px',
        marginBottom: '14px',
        lineHeight: '1.5'
      }}>
        ⚠ Recommendations are heuristic-based and depend on actual architecture, component coupling, routing behavior, and runtime usage patterns.
      </div>

      {detected.map((lib, i) => {
        const sugg = grouped[lib.name];
        const isOpen = open[lib.name] !== false; // Default open
        return (
          <div key={i} className="suggestion-card">
            <div className="sugg-header" onClick={() => toggle(lib.name)}>
              <div className="sugg-title">
                <span className="sugg-icon">📚</span>
                <strong>{lib.name}</strong>
                {lib.version && lib.version !== 'detected' && (
                  <span className="sugg-version">v{lib.version}</span>
                )}
                <span className="sugg-size">{lib.detectedSize}KB</span>
              </div>
              <span className="sugg-chevron">{isOpen ? '▼' : '▶'}</span>
            </div>

            {isOpen && sugg && sugg.alts.length > 0 && (
              <div className="sugg-alternatives">
                {sugg.alts.map((alt, ai) => (
                  <div key={ai} className="alt-card">
                    <div className="alt-header">
                      <strong className="alt-name">{alt.name}</strong>
                      <span className="alt-size">{alt.size}</span>
                      <span className="alt-savings">Estimated Theoretical Reduction ~{alt.savings}</span>
                      <span className={`alt-diff ${(alt.difficulty || '').toLowerCase().replace(/\s/g, '-')}`}>
                        {(() => {
                          const d = String(alt.difficulty || '');
                          if (d.toUpperCase() === 'EASY') return 'Low Migration Complexity';
                          if (d.toUpperCase() === 'MEDIUM') return 'Moderate Refactor Required';
                          if (d.toUpperCase() === 'HARD') return 'Significant Architectural Refactor';
                          return d;
                        })()}
                      </span>
                    </div>
                    {alt.npm && (
                      <code className="alt-install">npm install {alt.npm}</code>
                    )}
                    {alt.description && (
                      <p className="alt-desc">{alt.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isOpen && (!sugg || sugg.alts.length === 0) && (
              <div className="sugg-alternatives">
                <p style={{ padding: '4px', color: '#64748b', fontSize: '12px' }}>
                  No specific alternatives catalogued yet for {lib.name}. Try modular importing!
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main CodePreview ─────────────────────────────────────────────────────────

const CodePreview = ({ analysisResults }) => {
  const [activeTab, setActiveTab] = useState('css'); // 'css' | 'js' | 'libraries'
  const [selectedCss, setSelectedCss] = useState(0);
  const [selectedJs, setSelectedJs] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const cssFiles = analysisResults?.cssFiles || [];
  const jsFiles = analysisResults?.jsFiles || [];
  const detected = analysisResults?.detectedLibraries || [];
  const libSuggs = analysisResults?.librarySuggestions || [];

  const activeCssFile = cssFiles[selectedCss] || null;
  const activeJsFile = jsFiles[selectedJs] || null;

  // Total savings across all files
  const totalOriginal = [...cssFiles, ...jsFiles].reduce((s, f) => s + (f.totalBytes || 0), 0);
  const totalOptimized = [...cssFiles, ...jsFiles].reduce((s, f) => s + (f.usedBytes || 0), 0);
  const totalSaved = totalOriginal - totalOptimized;
  const savedPct = totalOriginal > 0
    ? ((totalSaved / totalOriginal) * 100).toFixed(1)
    : '0.0';

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleDownload = async () => {
    if (totalOriginal === 0) {
      showToast('No data to download. Please run an analysis first.', 'error');
      return;
    }

    setDownloading(true);
    try {
      const response = await axios.post(
        'http://localhost:3001/api/download-optimized',
        {
          url: analysisResults.url,
          cssFiles: cssFiles.map(f => ({
            url: f.url,
            totalBytes: f.totalBytes,
            usedBytes: f.usedBytes,
            unusedBytes: f.unusedBytes,
            unusedPercent: f.unusedPercent,
            optimizedCode: f.optimizedCode
          })),
          jsFiles: jsFiles.map(f => ({
            url: f.url,
            totalBytes: f.totalBytes,
            usedBytes: f.usedBytes,
            unusedBytes: f.unusedBytes,
            unusedPercent: f.unusedPercent,
            optimizedCode: f.optimizedCode
          })),
          detectedLibraries: detected,
          metrics: analysisResults.metrics
        },
        { responseType: 'blob' }
      );

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `webslim-optimized-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      showToast(`✅ Downloaded! Saved ${fmtBytes(totalSaved)} (${savedPct}% reduction)`, 'success');
    } catch (err) {
      console.error('Download failed:', err);
      showToast('❌ Download failed. Is the backend running?', 'error');
    }
    setDownloading(false);
  };

  const handleReport = () => {
    const report = {
      url: analysisResults.url,
      date: new Date().toISOString(),
      method: 'Chrome Coverage API (byte-accurate)',
      summary: {
        originalKB: (totalOriginal / 1024).toFixed(2),
        optimizedKB: (totalOptimized / 1024).toFixed(2),
        savedKB: (totalSaved / 1024).toFixed(2),
        reduction: savedPct + '%'
      },
      cssFiles: cssFiles.map(f => ({
        url: f.url,
        totalKB: (f.totalBytes / 1024).toFixed(2),
        usedKB: (f.usedBytes / 1024).toFixed(2),
        unusedKB: (f.unusedBytes / 1024).toFixed(2),
        unusedPct: f.unusedPercent
      })),
      jsFiles: jsFiles.map(f => ({
        url: f.url,
        totalKB: (f.totalBytes / 1024).toFixed(2),
        usedKB: (f.usedBytes / 1024).toFixed(2),
        unusedKB: (f.unusedBytes / 1024).toFixed(2),
        unusedPct: f.unusedPercent
      })),
      detectedLibraries: detected
    };

    const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const a = document.createElement('a');
    a.href = uri;
    a.download = `webslim-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('📊 Report downloaded!', 'success');
  };

  const handleShare = async () => {
    const text =
      `🌍 WebSlim Analysis — ${analysisResults.url}\n` +
      `JS unused: ${analysisResults.jsUnused?.toFixed(1)}%  |  CSS unused: ${analysisResults.cssUnused?.toFixed(1)}%\n` +
      `Total saved: ${fmtBytes(totalSaved)} (${savedPct}% reduction)\n` +
      `Carbon footprint: ${analysisResults.carbonFootprint?.toFixed(2)}g CO/load\n` +
      `Optimize your site at WebSlim `;
    try {
      await navigator.clipboard.writeText(text);
      showToast('🔗 Results copied to clipboard!', 'success');
    } catch {
      showToast('❌ Could not copy to clipboard', 'error');
    }
  };

  const activeFile = activeTab === 'css' ? activeCssFile : activeJsFile;

  return (
    <div className="preview-container">
      {/* Toast */}
      {toastMsg && (
        <div className={`toast-banner ${toastMsg.type}`}>{toastMsg.msg}</div>
      )}

      {/* Tabs */}
      <div className="tab-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'css' ? 'active' : ''}`}
            onClick={() => setActiveTab('css')}
          >
            🌸 CSS Stylesheets
            <span className="tab-badge">{cssFiles.length}</span>
          </button>
          <button
            className={`tab ${activeTab === 'js' ? 'active' : ''}`}
            onClick={() => setActiveTab('js')}
          >
            🔮 JS Source Bundles
            <span className="tab-badge">{jsFiles.length}</span>
          </button>
          <button
            className={`tab ${activeTab === 'libraries' ? 'active' : ''}`}
            onClick={() => setActiveTab('libraries')}
          >
            🧸 Heavy Libraries
            {detected.length > 0 && (
              <span className="tab-badge highlight">{detected.length}</span>
            )}
          </button>
        </div>

        {activeTab !== 'libraries' && (
          <input
            className="search-input"
            type="text"
            placeholder="🔍 Search in code…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        )}
      </div>

      {/* Modern Visual IDE Workspace Layout */}
      <div className="tab-content-wrap">
        <div className="tab-grid-system">
          <div className="content-area">
        {activeTab !== 'libraries' ? (
          <>
            {/* Left Explorer Sidebar */}
            <div className="file-tree-sidebar">
              <span className="sidebar-title">Workspace Explorer</span>
              <VerticalFileSelector
                files={activeTab === 'css' ? cssFiles : jsFiles}
                selected={activeTab === 'css' ? selectedCss : selectedJs}
                onSelect={idx => {
                  if (activeTab === 'css') {
                    setSelectedCss(idx);
                  } else {
                    setSelectedJs(idx);
                  }
                  setSearchTerm('');
                }}
                type={activeTab}
              />
            </div>

            {/* Right Code IDE Panel */}
            <div className="ide-editor-pane">
              {/* IDE Header */}
              <div className="ide-editor-header">
                <div className="ide-window-controls">
                  <span className="ide-control-dot red" />
                  <span className="ide-control-dot yellow" />
                  <span className="ide-control-dot green" />
                </div>
                <span className="ide-active-file-label">
                  {activeFile ? shortUrl(activeFile.url) : 'no_file'}
                </span>
                <div style={{ width: '40px' }} /> {/* Spacing */}
              </div>

              {/* IDE Summary Ribbon */}
              {activeFile && (
                <div className="file-summary-bar">
                  <div className="fsb-item">
                    <span className="fsb-label">Total Size</span>
                    <span className="fsb-value">{fmtBytes(activeFile.totalBytes)}</span>
                  </div>
                  <div className="fsb-item used">
                    <span className="fsb-label">Keep (Used)</span>
                    <span className="fsb-value">{fmtBytes(activeFile.usedBytes)}</span>
                  </div>
                  <div className="fsb-item unused">
                    <span className="fsb-label">Purge (Unused)</span>
                    <span className="fsb-value">{fmtBytes(activeFile.unusedBytes)}</span>
                  </div>
                  <div className="fsb-progress">
                    <div className="fsb-bar">
                      <div
                        className="fsb-bar-used"
                        style={{ width: `${activeFile.totalBytes > 0 ? ((activeFile.usedBytes / activeFile.totalBytes) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="fsb-pct">
                      {activeFile.totalBytes > 0 ? ((activeFile.usedBytes / activeFile.totalBytes) * 100).toFixed(0) : 0}% kept
                    </span>
                  </div>
                </div>
              )}

              {/* IDE Code Line Details */}
              <div className="code-legend">
                <span className="legend-item used">🟢 Active Range (Chromium verified execution)</span>
                <span className="legend-item unused">🔴 Dead Weight (Unexecuted / redundant)</span>
              </div>

              <AnnotatedCodeBlock
                lines={activeFile?.annotatedLines}
                searchTerm={searchTerm}
              />
            </div>
          </>
        ) : (
          <LibrarySuggestions suggestions={libSuggs} detected={detected} />
        )}
      </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="action-footer">
        <button
          className="btn-primary btn-download"
          onClick={handleDownload}
          disabled={downloading || totalOriginal === 0}
        >
          {downloading ? (
            <><span className="spinner-small" /> Packing optimized ZIP…</>
          ) : (
            <><span className="btn-icon">🚀</span> Compile & Download Optimized Assets ({fmtBytes(totalOptimized)})</>
          )}
        </button>

        <button className="btn-secondary" onClick={handleReport}>
          <span className="btn-icon">📊</span> Export Optimization Report
        </button>

        <button className="btn-outline" onClick={handleShare}>
          <span className="btn-icon">🔗</span> Share Platform Metrics
        </button>
      </div>

      <p className="disclaimer">
        ⚡ Byte-accurate de-bloating processed via native Coverage API mapping. Double check interactive flows in staging before production deploy.
      </p>
    </div>
  );
};

export default CodePreview;

