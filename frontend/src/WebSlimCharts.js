// src/WebSlimCharts.js
import React from 'react';

/**
 * 1. DonutProgress - Premium SVG circular progress chart.
 * Depicts percentage breakdown of unused/optimized bytes with neon glow.
 */
export const DonutProgress = ({ pct, label, type = 'red' }) => {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const activeColor = type === 'red' ? '#ef4444' : type === 'blue' ? '#3b82f6' : '#10b981';
  const glowId = `glow-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="donut-chart-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '12px' }}>
      <svg width="140" height="140" viewBox="0 0 120 120">
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Background track */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="transparent"
          stroke="#1e293b"
          strokeWidth="8"
        />
        
        {/* Foreground active ring */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="transparent"
          stroke={activeColor}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          filter={`url(#${glowId})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
        
        {/* Inner Label */}
        <text x="60" y="58" textAnchor="middle" fill="#f8fafc" fontSize="20" fontWeight="bold" fontFamily="sans-serif">
          {pct.toFixed(1)}%
        </text>
        <text x="60" y="78" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="sans-serif" letterSpacing="0.5">
          UNUSED
        </text>
      </svg>
      <span style={{ marginTop: '8px', color: '#cbd5e1', fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px' }}>{label}</span>
    </div>
  );
};

/**
 * 2. SavingsBarChart - Premium SVG bar chart for CSS/JS size comparison.
 */
export const SavingsBarChart = ({ originalJS, optimizedJS, originalCSS, optimizedCSS }) => {
  const maxBytes = Math.max(originalJS, originalCSS, 1);
  
  // Scale helper
  const getWidth = (bytes) => {
    return `${(bytes / maxBytes) * 100}%`;
  };

  const formatKB = (bytes) => {
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="savings-bar-chart" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'rgba(30, 41, 59, 0.3)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Weight Reduction Details</h4>
      
      {/* JavaScript Section */}
      <div className="chart-bar-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>
          <span>📦 JavaScript</span>
          <span style={{ color: '#ef4444' }}>-{(((originalJS - optimizedJS) / (originalJS || 1)) * 100).toFixed(0)}%</span>
        </div>
        
        {/* Original JS Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '80px', fontSize: '11px', color: '#64748b' }}>Original</div>
          <div style={{ flex: 1, height: '14px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: getWidth(originalJS), height: '100%', background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '4px', transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ width: '65px', fontSize: '11px', color: '#f8fafc', textAlign: 'right', fontFamily: 'monospace' }}>{formatKB(originalJS)}</div>
        </div>

        {/* Optimized JS Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '80px', fontSize: '11px', color: '#64748b' }}>Optimized</div>
          <div style={{ flex: 1, height: '14px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: getWidth(optimizedJS), height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '4px', transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ width: '65px', fontSize: '11px', color: '#34d399', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatKB(optimizedJS)}</div>
        </div>
      </div>

      <hr style={{ border: '0', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '4px 0' }} />

      {/* CSS Section */}
      <div className="chart-bar-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>
          <span>🎨 CSS</span>
          <span style={{ color: '#ef4444' }}>-{(((originalCSS - optimizedCSS) / (originalCSS || 1)) * 100).toFixed(0)}%</span>
        </div>

        {/* Original CSS Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '80px', fontSize: '11px', color: '#64748b' }}>Original</div>
          <div style={{ flex: 1, height: '14px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: getWidth(originalCSS), height: '100%', background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '4px', transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ width: '65px', fontSize: '11px', color: '#f8fafc', textAlign: 'right', fontFamily: 'monospace' }}>{formatKB(originalCSS)}</div>
        </div>

        {/* Optimized CSS Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '80px', fontSize: '11px', color: '#64748b' }}>Optimized</div>
          <div style={{ flex: 1, height: '14px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: getWidth(optimizedCSS), height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '4px', transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ width: '65px', fontSize: '11px', color: '#34d399', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatKB(optimizedCSS)}</div>
        </div>
      </div>
    </div>
  );
};

/**
 * 3. CarbonSavingsLineChart - Premium Bezier Curve chart showing monthly carbon projection comparisons.
 */
export const CarbonSavingsLineChart = ({ originalCO2PerPage, optimizedCO2PerPage }) => {
  const visitors = [5000, 10000, 25000, 50000, 100000];
  
  // Calculate total monthly CO2 in kg
  const originalData = visitors.map(v => (v * originalCO2PerPage) / 1000);
  const optimizedData = visitors.map(v => (v * optimizedCO2PerPage) / 1000);

  const maxVal = Math.max(...originalData, 1);

  // SVG dimensions
  const width = 500;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Map to points
  const getPoints = (data) => {
    return data.map((val, idx) => {
      const x = paddingLeft + (idx / (visitors.length - 1)) * chartWidth;
      const y = height - paddingBottom - (val / maxVal) * chartHeight;
      return { x, y };
    });
  };

  const origPoints = getPoints(originalData);
  const optPoints = getPoints(optimizedData);

  // Bezier curve string builder
  const getPathString = (points) => {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  return (
    <div style={{ background: 'rgba(30, 41, 59, 0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Monthly Carbon Projections (kg CO₂ / visitors)</h4>
      
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = paddingTop + ratio * chartHeight;
          const val = ((1 - ratio) * maxVal).toFixed(1);
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="sans-serif">
                {val}kg
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {visitors.map((v, idx) => {
          const x = paddingLeft + (idx / (visitors.length - 1)) * chartWidth;
          return (
            <text key={idx} x={x} y={height - 8} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="sans-serif">
              {v >= 1000 ? `${v / 1000}k` : v}
            </text>
          );
        })}

        {/* Original CO2 Line (Red/Glow) */}
        <path
          d={getPathString(origPoints)}
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ transition: 'all 0.5s ease' }}
        />
        {origPoints.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r="4" fill="#ef4444" stroke="#0f172a" strokeWidth="2" />
        ))}

        {/* Optimized CO2 Line (Green/Glow) */}
        <path
          d={getPathString(optPoints)}
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ transition: 'all 0.5s ease' }}
        />
        {optPoints.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="#0f172a" strokeWidth="2" />
        ))}
      </svg>
      
      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
          <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%' }} />
          <span>Original Setup</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
          <div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '50%' }} />
          <span>Optimized (WebSlim)</span>
        </div>
      </div>
    </div>
  );
};
