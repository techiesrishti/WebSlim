// backend/optimize/codeHighlighter.js

/**
 * This file handles the intelligent highlighting of unused code
 * It uses AST (Abstract Syntax Tree) parsing for JavaScript
 * and selector matching for CSS
 */

const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');

class CodeHighlighter {
  
  /**
   * Highlight unused CSS selectors in red
   * @param {string} css - Original CSS content
   * @param {Array} usedSelectors - List of selectors that are actually used
   * @returns {Object} Highlighted CSS with metadata
   */
  static highlightCSS(css, usedSelectors) {
    const lines = css.split('\n');
    const highlightedLines = [];
    const unusedSelectors = [];
    const usedSelectorSet = new Set(usedSelectors);

    // Parse CSS to understand selector structure
    let currentSelector = '';
    let inRule = false;
    let ruleLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Detect selector lines (ends with { or contains ,)
      if (trimmedLine.includes('{') && !trimmedLine.includes('}')) {
        // This line contains a selector
        const selectorPart = trimmedLine.split('{')[0].trim();
        currentSelector = selectorPart;
        
        // Check if this selector or any part of it is used
        const isUsed = this.isSelectorUsed(currentSelector, usedSelectorSet);
        
        if (!isUsed) {
          unusedSelectors.push(currentSelector);
          // Mark the entire rule as unused (red)
          highlightedLines.push(`<span class="unused-code" data-type="css-selector" data-selector="${currentSelector}">${line}</span>`);
          inRule = true;
          ruleLines = [line];
        } else {
          // Used selector - keep as is (green by default)
          highlightedLines.push(line);
          inRule = false;
        }
      } 
      else if (inRule && trimmedLine.includes('}')) {
        // End of unused rule
        ruleLines.push(line);
        // Join all rule lines and wrap in unused span
        const fullRule = ruleLines.join('\n');
        // Replace the last line with wrapped version
        highlightedLines.pop(); // Remove the last added line
        highlightedLines.push(`<span class="unused-code" data-type="css-rule" data-selector="${currentSelector}">${fullRule}</span>`);
        inRule = false;
        ruleLines = [];
      }
      else if (inRule) {
        // Inside an unused rule
        ruleLines.push(line);
        // Don't add to highlightedLines yet
      }
      else {
        // Regular line (comments, media queries, etc.)
        highlightedLines.push(line);
      }
    }

    return {
      highlighted: highlightedLines.join('\n'),
      stats: {
        totalSelectors: usedSelectors.length + unusedSelectors.length,
        usedSelectors: usedSelectors.length,
        unusedSelectors: unusedSelectors.length,
        unusedPercentage: ((unusedSelectors.length / (usedSelectors.length + unusedSelectors.length)) * 100).toFixed(1)
      },
      unusedSelectors
    };
  }

  /**
   * Check if a CSS selector is used
   */
  static isSelectorUsed(selector, usedSelectorSet) {
    // Split complex selectors (e.g., ".btn, .button" -> [".btn", ".button"])
    const parts = selector.split(',').map(s => s.trim());
    
    // Check if ANY part of the selector is used
    return parts.some(part => {
      // Extract class names and IDs
      const classMatches = part.match(/\.([a-zA-Z0-9_-]+)/g) || [];
      const idMatches = part.match(/#([a-zA-Z0-9_-]+)/g) || [];
      
      const allSelectors = [...classMatches, ...idMatches, part];
      
      return allSelectors.some(sel => usedSelectorSet.has(sel));
    });
  }

  /**
   * Highlight unused JavaScript functions/variables in red
   * @param {string} js - Original JavaScript content
   * @param {Array} usedFunctions - List of functions that are actually called
   * @returns {Object} Highlighted JavaScript with metadata
   */
  static highlightJS(js, usedFunctions) {
    try {
      // Parse JavaScript into AST
      const ast = parse(js, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });

      const usedFunctionSet = new Set(usedFunctions);
      const unusedItems = [];
      const lines = js.split('\n');
      
      // Track which lines are unused
      const lineUsage = new Array(lines.length).fill(true); // true = used, false = unused
      
      // Traverse AST to find function declarations
      traverse(ast, {
        // Function declarations
        FunctionDeclaration(path) {
          const funcName = path.node.id?.name;
          if (funcName && !usedFunctionSet.has(funcName)) {
            const { start, end } = path.node.loc;
            if (start && end) {
              // Mark all lines of this function as unused
              for (let i = start.line - 1; i < end.line; i++) {
                lineUsage[i] = false;
              }
              unusedItems.push({
                name: funcName,
                type: 'function',
                lines: `${start.line}-${end.line}`
              });
            }
          }
        },
        
        // Function expressions assigned to variables
        VariableDeclarator(path) {
          if (path.node.init && 
              (path.node.init.type === 'ArrowFunctionExpression' || 
               path.node.init.type === 'FunctionExpression')) {
            
            const funcName = path.node.id?.name;
            if (funcName && !usedFunctionSet.has(funcName)) {
              const { start, end } = path.node.loc;
              if (start && end) {
                for (let i = start.line - 1; i < end.line; i++) {
                  lineUsage[i] = false;
                }
                unusedItems.push({
                  name: funcName,
                  type: 'arrow-function',
                  lines: `${start.line}-${end.line}`
                });
              }
            }
          }
        },
        
        // Class methods
        ClassMethod(path) {
          const methodName = path.node.key?.name;
          const className = path.parentPath?.node.id?.name;
          const fullName = className ? `${className}.${methodName}` : methodName;
          
          if (!usedFunctionSet.has(fullName) && !usedFunctionSet.has(methodName)) {
            const { start, end } = path.node.loc;
            if (start && end) {
              for (let i = start.line - 1; i < end.line; i++) {
                lineUsage[i] = false;
              }
              unusedItems.push({
                name: fullName,
                type: 'method',
                lines: `${start.line}-${end.line}`
              });
            }
          }
        }
      });

      // Generate highlighted code
      const highlightedLines = lines.map((line, index) => {
        if (!lineUsage[index]) {
          // Unused line - wrap in red span
          return `<span class="unused-code" data-type="js" data-line="${index + 1}">${line}</span>`;
        }
        // Used line - keep as is (green by default)
        return line;
      });

      const totalFunctions = this.countFunctions(ast);
      
      return {
        highlighted: highlightedLines.join('\n'),
        stats: {
          totalFunctions,
          usedFunctions: usedFunctions.length,
          unusedFunctions: unusedItems.length,
          unusedPercentage: ((unusedItems.length / totalFunctions) * 100).toFixed(1)
        },
        unusedItems
      };
      
    } catch (error) {
      console.error('Error highlighting JS:', error);
      // Fallback: simple line-by-line highlighting
      return this.fallbackHighlightJS(js, usedFunctions);
    }
  }

  /**
   * Count total functions in AST
   */
  static countFunctions(ast) {
    let count = 0;
    traverse(ast, {
      FunctionDeclaration() { count++; },
      FunctionExpression() { count++; },
      ArrowFunctionExpression() { count++; },
      ClassMethod() { count++; }
    });
    return count;
  }

  /**
   * Fallback JS highlighter if AST parsing fails
   */
  static fallbackHighlightJS(js, usedFunctions) {
    const lines = js.split('\n');
    const highlightedLines = [];
    const unusedItems = [];
    
    lines.forEach((line, index) => {
      // Simple pattern matching for functions
      const functionMatch = line.match(/function\s+(\w+)/) || 
                           line.match(/(\w+)\s*=\s*function/) ||
                           line.match(/(\w+)\s*=\s*\(.*\)\s*=>/);
      
      if (functionMatch) {
        const funcName = functionMatch[1];
        if (!usedFunctions.includes(funcName)) {
          highlightedLines.push(`<span class="unused-code" data-type="js-fallback">${line}</span>`);
          unusedItems.push({ name: funcName, type: 'function', line: index + 1 });
        } else {
          highlightedLines.push(line);
        }
      } else {
        highlightedLines.push(line);
      }
    });
    
    return {
      highlighted: highlightedLines.join('\n'),
      stats: {
        totalFunctions: unusedItems.length + usedFunctions.length,
        usedFunctions: usedFunctions.length,
        unusedFunctions: unusedItems.length,
        unusedPercentage: ((unusedItems.length / (unusedItems.length + usedFunctions.length)) * 100).toFixed(1)
      },
      unusedItems
    };
  }

  /**
   * Generate relatable carbon impact statistics
   */
  static calculateRelatableImpact(bytesSaved) {
    const kgCO2PerMB = 0.2; // Average CO2 per MB transferred
    const mbSaved = bytesSaved / (1024 * 1024);
    const kgCO2Saved = mbSaved * kgCO2PerMB;
    
    // Relatable metrics
    return {
      bytesSaved,
      mbSaved: mbSaved.toFixed(2),
      kgCO2Saved: kgCO2Saved.toFixed(3),
      
      // Fun comparisons
      comparisons: {
        phoneCharges: Math.round(kgCO2Saved * 100), // 0.01kg CO2 per phone charge
        treesPlanted: Math.round(kgCO2Saved * 20), // 0.05kg CO2 absorbed per tree per month
        carDistance: (kgCO2Saved * 10).toFixed(1), // 0.1kg CO2 per km driven
        youtubeMinutes: Math.round(mbSaved * 2), // 0.5MB per minute of YouTube
        emails: Math.round(mbSaved * 50) // 20KB per email
      },
      
      description: this.generateImpactDescription(kgCO2Saved, mbSaved)
    };
  }

  /**
   * Generate human-readable impact description
   */
  static generateImpactDescription(kgCO2Saved, mbSaved) {
    if (kgCO2Saved < 0.01) {
      return "Small but meaningful savings! Every byte counts toward a greener web.";
    } else if (kgCO2Saved < 0.1) {
      return "Great job! Your optimization saves enough energy to power a LED light for an hour.";
    } else if (kgCO2Saved < 1) {
      return `Impressive! You've saved ${mbSaved}MB of data - that's like streaming ${Math.round(mbSaved * 2)} minutes of YouTube.`;
    } else {
      return `Outstanding! Your ${kgCO2Saved}kg CO2 savings is equivalent to planting ${Math.round(kgCO2Saved * 20)} trees! 🌳`;
    }
  }
}

module.exports = CodeHighlighter;