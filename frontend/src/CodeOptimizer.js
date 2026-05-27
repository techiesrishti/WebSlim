// frontend/components/CodeOptimizer.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CodeOptimizer.css';

const CodeOptimizer = ({ analysisResults }) => {
  const [activeTab, setActiveTab] = useState('css');
  const [codeData, setCodeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [librarySuggestions, setLibrarySuggestions] = useState([]);
  const [selectedLines, setSelectedLines] = useState(new Set());
  const [showSideBySide, setShowSideBySide] = useState(false);

  // Fetch highlighted code when component mounts
  useEffect(() => {
    if (analysisResults) {
      fetchHighlightedCode();
      fetchLibrarySuggestions();
    }
  }, [analysisResults]);

  const fetchHighlightedCode = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:3001/api/analyze-code', {
        cssContent: analysisResults.rawCSS,
        jsContent: analysisResults.rawJS,
        usedSelectors: analysisResults.usedSelectors,
        usedFunctions: analysisResults.usedFunctions
      });
      
      setCodeData(response.data);
    } catch (error) {
      console.error('Failed to analyze code:', error);
      alert('Failed to analyze code. Please try again.');
    }
    setLoading(false);
  };

  const fetchLibrarySuggestions = async () => {
    try {
      const response = await axios.post('http://localhost:3001/api/suggest-replacements', {
        detectedLibraries: analysisResults.detectedLibraries || []
      });
      setLibrarySuggestions(response.data.suggestions);
    } catch (error) {
      console.error('Failed to get library suggestions:', error);
    }
  };

  const handleDownload = async () => {
    setOptimizing(true);
    try {
      const response = await axios.post('http://localhost:3001/api/download-optimized', {
        originalCSS: analysisResults.rawCSS,
        originalJS: analysisResults.rawJS,
        usedSelectors: analysisResults.usedSelectors,
        usedFunctions: analysisResults.usedFunctions,
        fileName: `webslim-${new Date().toISOString().slice(0,10)}`
      }, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `webslim-optimized-${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      // Show success message
      alert('✅ Optimization complete! Your files are downloading.');
      
    } catch (error) {
      console.error('Download failed:', error);
      alert('❌ Optimization failed. Please try again.');
    }
    setOptimizing(false);
  };

  const toggleLineSelection = (lineNumber) => {
    const newSelection = new Set(selectedLines);
    if (newSelection.has(lineNumber)) {
      newSelection.delete(lineNumber);
    } else {
      newSelection.add(lineNumber);
    }
    setSelectedLines(newSelection);
  };

  const getCarbonMessage = (co2) => {
    if (co2 < 0.1) return "✨ Every byte counts toward a greener web!";
    if (co2 < 0.5) return "📱 You're saving as much CO2 as charging a phone!";
    if (co2 < 1) return "☕ This optimization is like skipping one cup of tea's carbon footprint!";
    if (co2 < 5) return "🌳 Your optimization helps a tree do its job for a day!";
    return "🌟 Amazing! This is like planting a whole new tree every month!";
  };

  if (loading) {
    return (
      <div className="optimizer-container loading">
        <div className="spinner"></div>
        <h3>🔍 Analyzing your code...</h3>
        <p>Parsing CSS and JavaScript to find unused code</p>
      </div>
    );
  }

  return (
    <div className="optimizer-container">
      {/* Header with impressive stats */}
      <div className="optimizer-header">
        <h2>🎯 Code Optimizer</h2>
        {codeData?.combinedStats && (
          <div className="stats-banner">
            <div className="stat-item">
              <span className="stat-value">{codeData.combinedStats.averageUsage}%</span>
              <span className="stat-label">Code Usage</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">
                {((codeData.combinedStats.totalOriginalSize - codeData.combinedStats.totalOptimizedSize) / 1024).toFixed(1)}KB
              </span>
              <span className="stat-label">Potential Savings</span>
            </div>
            {codeData.carbonImpact && (
              <div className="stat-item highlight">
                <span className="stat-value">{codeData.carbonImpact.co2Saved}g CO₂</span>
                <span className="stat-label">Saved per Load</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'css' ? 'active' : ''}`}
          onClick={() => setActiveTab('css')}
        >
          🎨 CSS ({codeData?.css?.stats?.totalLines || 0} lines)
        </button>
        <button 
          className={`tab-btn ${activeTab === 'js' ? 'active' : ''}`}
          onClick={() => setActiveTab('js')}
        >
          📦 JavaScript ({codeData?.js?.stats?.totalLines || 0} lines)
        </button>
        <button 
          className={`tab-btn ${showSuggestions ? 'active' : ''}`}
          onClick={() => setShowSuggestions(!showSuggestions)}
        >
          💡 Smart Suggestions ({librarySuggestions.length})
        </button>
      </div>

      {/* Main Content Area */}
      <div className="content-area">
        {/* Code Preview with Red/Green Highlighting */}
        {!showSuggestions ? (
          <div className="code-preview">
            <div className="preview-header">
              <div className="legend">
                <span className="legend-used">🟢 Used Code</span>
                <span className="legend-unused">🔴 Unused Code (will be removed)</span>
              </div>
              <div className="preview-controls">
                <button 
                  className="btn-outline"
                  onClick={() => setShowSideBySide(!showSideBySide)}
                >
                  {showSideBySide ? 'Single View' : 'Side by Side'}
                </button>
              </div>
            </div>
            
            <div className={`code-container ${showSideBySide ? 'side-by-side' : ''}`}>
              {/* Original Code */}
              <div className="code-column">
                <h4>Original Code</h4>
                <div 
                  className="code-lines"
                  dangerouslySetInnerHTML={{ 
                    __html: activeTab === 'css' 
                      ? codeData?.css?.highlighted 
                      : codeData?.js?.highlighted 
                  }} 
                />
              </div>
              
              {/* Optimized Preview (if side by side) */}
              {showSideBySide && (
                <div className="code-column">
                  <h4>Will Become</h4>
                  <div className="code-lines optimized-preview">
                    {/* This would show only used lines */}
                    {activeTab === 'css' 
                      ? codeData?.css?.highlighted?.split('</div>')
                          .filter(line => line.includes('used'))
                          .map(line => line + '</div>')
                          .join('')
                      : codeData?.js?.highlighted?.split('</div>')
                          .filter(line => line.includes('used'))
                          .map(line => line + '</div>')
                          .join('')
                    }
                  </div>
                </div>
              )}
            </div>
            
            {/* Stats for current file */}
            {codeData?.[activeTab]?.stats && (
              <div className="file-stats">
                <div className="progress-bar">
                  <div 
                    className="progress-used" 
                    style={{ width: `${codeData[activeTab].stats.usedPercentage}%` }}
                  >
                    {codeData[activeTab].stats.usedPercentage}% Used
                  </div>
                </div>
                <div className="stats-grid">
                  <div>📊 Total: {codeData[activeTab].stats.totalLines} lines</div>
                  <div>🟢 Used: {codeData[activeTab].stats.usedLines} lines</div>
                  <div>🔴 Unused: {codeData[activeTab].stats.unusedLines} lines</div>
                  <div>📦 Size: {(codeData[activeTab].stats.totalSize / 1024).toFixed(2)} KB</div>
                  <div>✨ Optimized: {(codeData[activeTab].stats.estimatedOptimizedSize / 1024).toFixed(2)} KB</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Library Suggestions Panel */
          <div className="suggestions-panel">
            <h3>🔎 Dependency Modernization Insights</h3>
            <p className="suggestions-intro">
                      Detected potentially heavy dependencies. Lightweight alternatives MAY reduce frontend bundle weight depending on integration depth, usage patterns, and observed runtime behavior.
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
            
            {librarySuggestions.map((suggestion, idx) => (
              <div key={idx} className="suggestion-card">
                <div className="suggestion-header">
                  <h4>{suggestion.library}</h4>
                  <span className="current-size">Current: {suggestion.currentSize}</span>
                </div>
                
                {suggestion.alternatives.map((alt, altIdx) => (
                  <div key={altIdx} className="alternative-item">
                    <div className="alternative-info">
                      <strong>{alt.name}</strong>
                      <span className="size">{alt.size}</span>
                      <span className="savings">Theoretical Reduction (integration/usage dependent) ~{alt.savings}</span>
                      <span className={`difficulty ${String(alt.difficulty || '').toLowerCase()}`}>
                        {(() => {
                          const d = String(alt.difficulty || '');
                          if (d.toUpperCase() === 'EASY') return 'Potentially Lower Migration Effort';
                          if (d.toUpperCase() === 'MEDIUM') return 'Moderate Migration Effort Likely';
                          if (d.toUpperCase() === 'HARD') return 'Higher Refactor Complexity Possible';
                          return d;
                        })()}
                      </span>
                      <div className="engineering-note" style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', lineHeight: '1.4' }}>
                        {(() => {
                          const libName = String(alt.name || '').toLowerCase();
                          const original = String(suggestion.library || '').toLowerCase();
                          const hint = original.includes('tailwind') || libName.includes('tailwind')
                            ? 'Requires manual utility-class migration and component-level refactoring.'
                            : original.includes('purecss') || libName.includes('purecss')
                              ? 'Best suited for lightweight layout systems and minimal component dependencies.'
                              : original.includes('bulma') || libName.includes('bulma')
                                ? 'May require restructuring existing responsive and utility class patterns.'
                                : 'Migration effort can vary with integration depth, coupling, routing architecture, and runtime usage patterns.';
                          return hint;
                        })()}
                      </div>
                    </div>
                    <pre className="code-snippet">
                      {alt.code}
                    </pre>
                    <button className="btn-small">Apply Suggestion</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Environmental Impact Section */}
      {codeData?.carbonImpact && (
        <div className="impact-section">
          <h3>🌍 Your Environmental Impact</h3>
          <div className="impact-visualization">
            <div className="impact-metric">
              <span className="impact-number">{codeData.carbonImpact.co2Saved}g</span>
              <span>CO₂ saved per page load</span>
            </div>
            <div className="impact-metric">
              <span className="impact-number">
                {(codeData.carbonImpact.co2Saved * 10000 / 1000).toFixed(1)}kg
              </span>
              <span>Monthly savings (10k visitors)</span>
            </div>
            <div className="impact-message">
              {getCarbonMessage(parseFloat(codeData.carbonImpact.co2Saved))}
            </div>
            <div className="impact-equivalent">
              {codeData.carbonImpact.visual}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-buttons">
        <button 
          className="btn-primary download-btn"
          onClick={handleDownload}
          disabled={optimizing}
        >
          {optimizing ? (
            <>⚙️ Optimizing...</>
          ) : (
            <>🚀 Download Optimized Code</>
          )}
        </button>
        
        <button className="btn-secondary">
          📊 Generate Full Report
        </button>
        
        <button className="btn-outline">
          🔗 Share Results
        </button>
      </div>
      
      <p className="disclaimer">
        ⚡ WebSlim removes all red-highlighted code while preserving functionality. 
        Always test before deploying to production.
      </p>
    </div>
  );
};

export default CodeOptimizer;