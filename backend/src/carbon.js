// backend/src/carbon.js
function calculateCarbonImpact(fileSizeKB, monthlyVisitors = 10000) {
  // Industry standard: ~0.5g CO2 per MB transferred
  const co2PerMB = 0.5; // grams
  
  // FIX: Perform all calculations using raw floats first, and round only for final display/return
  const perPageRaw = (fileSizeKB / 1024) * co2PerMB;
  const monthlyRaw = perPageRaw * monthlyVisitors;
  const yearlyRaw = monthlyRaw * 12;
  const treesEquivalentRaw = yearlyRaw / 21000;
  
  return {
    perPage: perPageRaw.toFixed(2),
    monthly: monthlyRaw.toFixed(2),
    yearly: yearlyRaw.toFixed(2),
    treesEquivalent: treesEquivalentRaw.toFixed(2),
    phoneCharges: Math.round(monthlyRaw * 0.1) // ~100 phone charges per kg CO2
  };
}

// Get human-readable impact message
function getImpactMessage(co2PerPage) {
  if (co2PerPage < 0.1) return "✨ Every byte counts toward a greener web!";
  if (co2PerPage < 0.5) return "📱 Like charging your phone once";
  if (co2PerPage < 1) return "☕ Equivalent to one cup of tea's carbon footprint";
  if (co2PerPage < 5) return "🌳 A tree absorbs this in one day";
  return "🌟 Amazing! This is like planting a tree every month";
}

module.exports = { calculateCarbonImpact, getImpactMessage };