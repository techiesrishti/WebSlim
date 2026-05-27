// src/CarbonSavings.js
import React, { useState } from 'react';
import { CarbonSavingsLineChart } from './WebSlimCharts';

/**
 * CarbonSavings - Premium sustainability analytics suite.
 * Visualizes the direct ecological benefits of code de-bloating.
 */
const CarbonSavings = ({ originalSizeKB, optimizedSizeKB }) => {
  const [visitorsInput, setVisitorsInput] = useState(10000);

  // Industry Standard: ~0.5g CO2 per MB transferred
  const co2PerMB = 0.5; // grams

  const originalCO2PerPage = (originalSizeKB / 1024) * co2PerMB;
  const optimizedCO2PerPage = (optimizedSizeKB / 1024) * co2PerMB;

  const originalMonthlyCO2 = originalCO2PerPage * visitorsInput;
  const optimizedMonthlyCO2 = optimizedCO2PerPage * visitorsInput;

  const monthlySavedGrams = originalMonthlyCO2 - optimizedMonthlyCO2;
  const monthlySavedKg = monthlySavedGrams / 1000;

  // ---- Sustainable web heuristic model ----
  // Estimate bandwidth reduction energy using: ~0.81 kWh per GB transferred
  // Then map energy -> phone charges using: 1 phone charge ~= 0.011 kWh
  const savedTotalKB = Math.max(0, originalSizeKB - optimizedSizeKB);
  const savedTotalBytes = savedTotalKB * 1024;
  // Scale bandwidth/energy by monthly active visitors so this card updates
  // when the slider is moved.
  const savedBandwidthGBPerPage = savedTotalBytes / (1024 * 1024 * 1024);

  const savedBandwidthGB = savedBandwidthGBPerPage * visitorsInput;

  const energySavedKWh = savedBandwidthGB * 0.81;
  const phoneCharges = energySavedKWh / 0.011;


  // Estimate ecological offsets using CO2-equivalence (consistent heuristic):
  // 1 mature tree absorbs ~21 kg CO2 per year
  const totalCO2SavedKgYearly = (monthlySavedGrams * 12) / 1000;
  const treesEquivalent = totalCO2SavedKgYearly / 21;

  // Keep carbon projection calculations for the calculator + chart side.
  void monthlySavedKg;

  // NOTE: sustainability equivalency cards are replaced/removed for this task.
  // Keep carbon projection calculations for the calculator + chart side.







  // - Driving a standard car emits ~120g of CO2 per km
  const carKmSaved = (monthlySavedGrams / 120).toFixed(1);



  return (

    <div className="carbon-analytics-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      
      {/* Metric Cards Grid */}

      <div className="carbon-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        {/* Monthly Savings Card */}
        <div className="glass-card green" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🌳</div>
          <span style={{ display: 'block', fontSize: '11px', color: '#34d399', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Ecological Offsets</span>
          <h3 style={{ margin: '4px 0', fontSize: '26px', color: '#f8fafc', fontWeight: '800' }}>
            {Math.max(0, treesEquivalent).toFixed(2)}
          </h3>
          <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>Mature trees equivalent planted yearly</p>
        </div>

        {/* Smartphone Charges Card */}
        <div className="glass-card blue" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚡</div>
          <span style={{ display: 'block', fontSize: '11px', color: '#60a5fa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Energy Saved</span>
          <h3 style={{ margin: '4px 0', fontSize: '26px', color: '#f8fafc', fontWeight: '800' }}>
            {Math.max(0, Math.round(phoneCharges))}
          </h3>
          <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>Smartphone charges saved monthly</p>
        </div>


        {/* Travel Offsets Card */}
        <div className="glass-card orange" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🚗</div>
          <span style={{ display: 'block', fontSize: '11px', color: '#fb923c', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Driving Avoided</span>
          <h3 style={{ margin: '4px 0', fontSize: '26px', color: '#f8fafc', fontWeight: '800' }}>{carKmSaved} <span style={{ fontSize: '14px', fontWeight: 'normal' }}>km</span></h3>
          <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>Car driving emissions saved monthly</p>
        </div>


      </div>

      {/* Calculator and Chart Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
        
        {/* interactive calculator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', justifyContent: 'center' }}>
          <h3 style={{ margin: '0', fontSize: '16px', color: '#f8fafc', fontWeight: '700' }}>🌍 Sustainability Calculator</h3>
          <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
            Enter your monthly active visitors to project the positive impact of deploying your optimized code.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Active Visitors</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="range"
                min="1000"
                max="250000"
                step="1000"
                value={visitorsInput}
                onChange={(e) => setVisitorsInput(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#10b981', cursor: 'pointer' }}
              />
              <span style={{ width: '80px', textAlign: 'right', fontSize: '13px', color: '#f8fafc', fontWeight: 'bold', fontFamily: 'monospace' }}>
                {visitorsInput.toLocaleString()}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.02)', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#94a3b8' }}>Original CO₂ monthly:</span>
              <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{(originalMonthlyCO2).toFixed(1)}g</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#94a3b8' }}>Optimized CO₂ monthly:</span>
              <span style={{ color: '#10b981', fontWeight: 'bold', fontFamily: 'monospace' }}>{(optimizedMonthlyCO2).toFixed(1)}g</span>
            </div>
            <hr style={{ border: '0', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
              <span style={{ color: '#34d399' }}>Avoided monthly:</span>
              <span style={{ color: '#34d399', fontFamily: 'monospace' }}>{(monthlySavedGrams).toFixed(1)}g ({((monthlySavedGrams / (originalMonthlyCO2 || 1)) * 100).toFixed(0)}% saved)</span>
            </div>
          </div>
        </div>

        {/* Bezier curve projection */}
        <CarbonSavingsLineChart
          originalCO2PerPage={originalCO2PerPage}
          optimizedCO2PerPage={optimizedCO2PerPage}
        />
      </div>
    </div>
  );
};

export default CarbonSavings;