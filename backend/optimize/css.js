// backend/src/optimize/css.js
const postcss = require('postcss');
const purgecss = require('@fullhuman/postcss-purgecss');

async function optimizeCSS(cssContent, usedSelectors) {
  const result = await postcss([
    purgecss({
      content: [], // We'll pass selectors directly
      safelist: ['html', 'body'], // Always keep these
      extractors: [{
        extractor: () => usedSelectors,
        extensions: ['html']
      }]
    })
  ]).process(cssContent, { from: undefined });
  
  return result.css;
}