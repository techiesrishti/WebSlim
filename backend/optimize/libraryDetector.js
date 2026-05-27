// backend/optimize/libraryDetector.js
//
// Used by /api/suggest-replacements.
// Takes the detectedLibraries array from the analyzer (which has key, name,
// alternatives fields set) and enriches/returns them.
// The analyzer already detects libraries with rich alternative data, so this
// module acts as a post-processor and recommendation generator.

class LibraryDetector {

  _parseKB(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return null;

    const s = value.trim().toUpperCase();
    // Expected formats: '15KB', '2KB', '0KB' (sometimes may include spaces)
    const m = s.match(/^(\d+(?:\.\d+)?)\s*KB$/);
    if (!m) return null;
    return parseFloat(m[1]);
  }

  /**
   * Takes an array of detected libraries (from analyzer.js detectLibraries)
   * and returns enriched suggestion objects for the frontend.
   *
   * Each input library has: { key, name, version, detectedSize, alternatives }
   * Each alternative has:   { name, size, savings, difficulty, npm }
   */
  getAlternatives(detectedLibraries) {
    if (!detectedLibraries || detectedLibraries.length === 0) return [];

    return detectedLibraries.flatMap(lib => {
      const origKB = this._parseKB(lib.detectedSize);

      const alts = (lib.alternatives || [])
        .filter(alt => {
          const altKB = this._parseKB(alt.size);
          // Keep only strictly smaller alternatives (smaller payload candidates)
          return origKB !== null && altKB !== null && altKB < origKB;
        })
        .sort((a, b) => {
          const aKB = this._parseKB(a.size);
          const bKB = this._parseKB(b.size);
          // Keep parsing failures at the end
          if (aKB === null && bKB === null) return 0;
          if (aKB === null) return 1;
          if (bKB === null) return -1;
          return aKB - bKB;
        });

      return alts.map(alt => ({
        originalLibrary: lib.name,
        originalSize:    lib.detectedSize + 'KB',
        alternative:     alt,
        potentialSavings: alt.savings,
        implementationEffort: alt.difficulty,
        recommendation:  this._recommend(lib, alt)
      }));
    });
  }

  _recommend(lib, alt) {
    const origKB = parseFloat(lib.detectedSize) || 0;
    const altKB  = parseFloat(alt.size) || 0;

    if (altKB === 0) {
      return `🔥 Eliminate ${lib.name} entirely — modern browsers provide this natively.`;
    }
    const saved = origKB - altKB;
    const pct   = origKB > 0 ? Math.round((saved / origKB) * 100) : 0;
    if (pct >= 80) {
      return `🔎 ${alt.name} is ${pct}% smaller in theory. Integration requirements may affect real-world bundle savings vs. observed usage.`;
    }
    return `📌 ${alt.name} may reduce frontend payload by ~${pct}% (~${saved.toFixed(0)}KB) depending on integration depth and runtime usage patterns compared to ${lib.name}.`;
  }

  /**
   * Calculate total potential byte savings if the best alternative is chosen
   * for each detected library.
   */
  calculatePotentialSavings(detectedLibraries) {
    let currentKB   = 0;
    let optimizedKB = 0;

    for (const lib of (detectedLibraries || [])) {
      const origKB = this._parseKB(lib.detectedSize) ?? 0;
      currentKB += origKB;

      const smallerAlts = (lib.alternatives || []).filter(alt => {
        const altKB = this._parseKB(alt.size);
        return altKB !== null && altKB < origKB;
      });

      // If no smaller alternative exists, keep original size.
      const best = smallerAlts.reduce((bestAlt, alt) => {
        if (!bestAlt) return alt;
        const bestKB = this._parseKB(bestAlt.size);
        const altKB = this._parseKB(alt.size);
        if (bestKB === null) return alt;
        return (altKB !== null && altKB < bestKB) ? alt : bestAlt;
      }, null);

      optimizedKB += best ? (this._parseKB(best.size) ?? 0) : origKB;
    }

    const saved = currentKB - optimizedKB;
    return {
      currentTotal:   currentKB   + 'KB',
      optimizedTotal: optimizedKB + 'KB',
      savings:        currentKB > 0 ? Math.round((saved / currentKB) * 100) + '%' : '0%',
      bytesSaved:     saved * 1024
    };
  }
}

module.exports = new LibraryDetector();
